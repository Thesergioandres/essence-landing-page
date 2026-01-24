import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "../models/Sale.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  // Verificar si existen documentos con el campo 'items'
  const countWithItems = await Sale.countDocuments({
    items: { $exists: true },
  });
  console.log(`🔎 Ventas con array 'items': ${countWithItems}`);

  if (countWithItems > 0) {
    const cursor = Sale.find({ items: { $exists: true } }).cursor();
    let processed = 0;

    for (
      let doc = await cursor.next();
      doc != null;
      doc = await cursor.next()
    ) {
      // Si 'items' existe, lo limpiamos o eliminamos si la arquitectura es 'Una Venta = Un Producto'
      // Pero el usuario pidió "Reescriba el array items... eliminando cualquier campo que NO sea..."
      // Esto implica que QUIERE mantener el array items pero LIMPIO.
      // Asumiremos que si existe, lo limpiamos.

      if (Array.isArray(doc.items)) {
        const cleanItems = doc.items
          .map((item) => ({
            product: item.product, // ID
            name: item.name || item.productName,
            price: item.price || item.unitPrice || item.salePrice,
            quantity: item.quantity,
            cost: item.cost,
            // Imagen solo string
            image:
              typeof item.image === "string"
                ? item.image
                : item.image?.secure_url || null,
          }))
          .filter((item) => item.product); // Filtrar vacíos

        // Usamos updateOne para forzar el set de items (si el modelo no lo tiene, necesitamos strict: false o bypass)
        // O mejor, usamos unset para borrar todo lo demas y set para items
        await Sale.collection.updateOne(
          { _id: doc._id },
          {
            $set: { items: cleanItems },
            // Eliminar campos basura comunes si existen
            $unset: {
              "items.$[].description": 1,
              "items.$[].longDescription": 1,
              "items.$[].stockHistory": 1,
              "items.$[].supplier": 1,
              "items.$[].cloudinary": 1, // hipotetico
            },
          },
        );
      }
      processed++;
      if (processed % 100 === 0) console.log(`Processed ${processed} sales...`);
    }
    console.log(`✅ Procesadas ${processed} ventas.`);
  } else {
    console.log(
      "✅ No se encontraron ventas con campo 'items' (Data Diet OK).",
    );
  }

  // También eliminar 'paymentProof' si pesa mucho (base64) y queremos limpiar, pero el usuario no lo pidió explicitamente.
  // El usuario dijo "El controlador createSale está guardando el documento Product COMPLETO dentro del array items"

  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
