import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Configurar dotenv con la ruta correcta
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

async function fixCloudIndexes() {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
      console.error("❌ MONGODB_URI no encontrado en .env");
      process.exit(1);
    }

    console.log("🔗 Conectando a MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB Atlas\n");

    const db = mongoose.connection.db;
    const collections = await db
      .listCollections({ name: "customers" })
      .toArray();

    if (collections.length === 0) {
      console.log("ℹ️  La colección 'customers' no existe en Atlas");
      await mongoose.connection.close();
      return;
    }

    const collection = db.collection("customers");

    // Listar índices actuales
    console.log("📋 Índices actuales:");
    const indexes = await collection.indexes();
    indexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
      if (idx.sparse) console.log(`    (sparse)`);
      if (idx.partialFilterExpression)
        console.log(
          `    (partial: ${JSON.stringify(idx.partialFilterExpression)})`
        );
    });

    // Contar clientes
    const count = await collection.countDocuments();
    console.log(`\n📊 Total de clientes: ${count}`);

    // Buscar índices problemáticos (sin _partial en el nombre)
    const problematicIndexes = indexes.filter(
      (idx) =>
        (idx.name === "business_1_email_1" ||
          idx.name === "business_1_phone_1") &&
        !idx.name.includes("_partial")
    );

    if (problematicIndexes.length > 0) {
      console.log("\n⚠️  Encontrados índices problemáticos:");
      problematicIndexes.forEach((idx) => console.log(`  - ${idx.name}`));

      console.log("\n🗑️  Eliminando índices problemáticos...");
      for (const idx of problematicIndexes) {
        try {
          await collection.dropIndex(idx.name);
          console.log(`  ✅ Eliminado: ${idx.name}`);
        } catch (e) {
          console.log(`  ⚠️  Error eliminando ${idx.name}:`, e.message);
        }
      }

      console.log("\n✨ Creando índices parciales correctos...");

      // Crear índice parcial para email
      try {
        await collection.createIndex(
          { business: 1, email: 1 },
          {
            unique: true,
            name: "business_1_email_1_partial",
            partialFilterExpression: { email: { $type: "string" } },
          }
        );
        console.log("  ✅ Creado: business_1_email_1_partial");
      } catch (e) {
        console.log("  ⚠️  Error creando email index:", e.message);
      }

      // Crear índice parcial para phone
      try {
        await collection.createIndex(
          { business: 1, phone: 1 },
          {
            unique: true,
            name: "business_1_phone_1_partial",
            partialFilterExpression: { phone: { $type: "string" } },
          }
        );
        console.log("  ✅ Creado: business_1_phone_1_partial");
      } catch (e) {
        console.log("  ⚠️  Error creando phone index:", e.message);
      }

      // Verificar índices finales
      console.log("\n📋 Índices finales:");
      const finalIndexes = await collection.indexes();
      finalIndexes.forEach((idx) => {
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        if (idx.partialFilterExpression)
          console.log(
            `    (partial: ${JSON.stringify(idx.partialFilterExpression)})`
          );
      });
    } else {
      console.log("\n✅ Los índices parciales ya están correctos");
    }

    // Mostrar algunos clientes
    if (count > 0) {
      console.log("\n👥 Primeros clientes:");
      const customers = await collection.find().limit(5).toArray();
      customers.forEach((c) => {
        console.log(
          `  - ${c.name} | email: ${c.email || "(sin email)"} | phone: ${
            c.phone || "(sin teléfono)"
          }`
        );
      });
    }

    await mongoose.connection.close();
    console.log(
      "\n✅ Proceso completado. Reinicia el servidor si es necesario.\n"
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

fixCloudIndexes();
