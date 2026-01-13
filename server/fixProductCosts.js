/**
 * Script para corregir el totalInventoryValue y averageCost de productos existentes
 * que no fueron inicializados correctamente.
 *
 * Uso: node fixProductCosts.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model("Product", ProductSchema);

async function fixProductCosts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB");

    // Buscar productos con totalInventoryValue incorrecto o no inicializado
    const products = await Product.find({
      $or: [
        { totalInventoryValue: { $exists: false } },
        { totalInventoryValue: null },
        { totalInventoryValue: 0 },
        { averageCost: { $exists: false } },
        { averageCost: null },
        { averageCost: 0 },
      ],
    });

    console.log(`📦 Encontrados ${products.length} productos para corregir`);

    let fixed = 0;
    for (const product of products) {
      const totalStock = product.totalStock || 0;
      const purchasePrice = product.purchasePrice || 0;

      // Si no hay averageCost, usar purchasePrice
      const averageCost = product.averageCost || purchasePrice;

      // Calcular totalInventoryValue correctamente
      const totalInventoryValue = totalStock * averageCost;

      if (totalStock > 0) {
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              averageCost: averageCost,
              totalInventoryValue: totalInventoryValue,
            },
          }
        );

        console.log(
          `  ✅ ${product.name}: Stock=${totalStock}, PurchasePrice=${purchasePrice}, ` +
            `AverageCost=${averageCost}, TotalValue=${totalInventoryValue}`
        );
        fixed++;
      }
    }

    console.log(`\n🎉 Corregidos ${fixed} productos`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Desconectado de MongoDB");
  }
}

fixProductCosts();
