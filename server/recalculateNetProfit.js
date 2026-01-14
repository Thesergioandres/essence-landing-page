/**
 * Script para recalcular netProfit en ventas existentes
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "./models/Sale.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function recalculateNetProfit() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    console.log("\n🔄 Recalculando netProfit para todas las ventas...");

    // Obtener todas las ventas
    const sales = await Sale.find({});
    console.log(`📊 Total de ventas encontradas: ${sales.length}`);

    let updated = 0;
    let skipped = 0;

    for (const sale of sales) {
      // Calcular netProfit
      const totalAdditionalCosts = sale.totalAdditionalCosts || 0;
      const shippingCost = sale.shippingCost || 0;
      const discount = sale.discount || 0;
      const totalExtraCosts = totalAdditionalCosts + shippingCost;
      const calculatedNetProfit =
        (sale.totalProfit || 0) - totalExtraCosts - discount;

      // Verificar si necesita actualización (undefined o valor diferente)
      const currentNetProfit = sale.netProfit;
      const needsUpdate =
        currentNetProfit === undefined ||
        currentNetProfit === null ||
        Math.abs(currentNetProfit - calculatedNetProfit) > 0.01;

      if (needsUpdate) {
        // Actualizar directamente en la base de datos sin triggerar hooks
        await Sale.updateOne(
          { _id: sale._id },
          {
            $set: {
              netProfit: calculatedNetProfit,
              totalAdditionalCosts: totalAdditionalCosts,
            },
          }
        );
        updated++;
        console.log(
          `✅ ${sale.saleId}: totalProfit=${sale.totalProfit}, netProfit=${calculatedNetProfit} (costos=${totalExtraCosts}, descuento=${discount})`
        );
      } else {
        skipped++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Actualizadas: ${updated}`);
    console.log(`   ⏭️  Sin cambios: ${skipped}`);
    console.log(`   📈 Total: ${sales.length}`);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Desconectado de MongoDB");
  }
}

recalculateNetProfit();
