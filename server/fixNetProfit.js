/**
 * Script para forzar actualización de netProfit
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "./models/Sale.js";

dotenv.config();

async function fixNetProfit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Conectado a MongoDB");

  // Ver el estado actual de la última venta
  const lastSale = await Sale.findOne().sort({ createdAt: -1 }).lean();
  console.log("\n=== Última venta (ANTES) ===");
  console.log("saleId:", lastSale.saleId);
  console.log("totalProfit:", lastSale.totalProfit);
  console.log(
    "netProfit:",
    lastSale.netProfit,
    "(tipo:",
    typeof lastSale.netProfit + ")"
  );
  console.log("totalAdditionalCosts:", lastSale.totalAdditionalCosts);
  console.log("additionalCosts:", JSON.stringify(lastSale.additionalCosts));
  console.log("shippingCost:", lastSale.shippingCost);
  console.log("discount:", lastSale.discount);

  // Usar aggregation pipeline para actualizar
  const result = await Sale.updateMany({}, [
    {
      $set: {
        netProfit: {
          $subtract: [
            { $ifNull: ["$totalProfit", 0] },
            {
              $add: [
                { $ifNull: ["$totalAdditionalCosts", 0] },
                { $ifNull: ["$shippingCost", 0] },
                { $ifNull: ["$discount", 0] },
              ],
            },
          ],
        },
      },
    },
  ]);

  console.log("\n=== Resultado ===");
  console.log("Ventas actualizadas:", result.modifiedCount);

  // Verificar después
  const lastSaleAfter = await Sale.findOne().sort({ createdAt: -1 }).lean();
  console.log("\n=== Última venta (DESPUÉS) ===");
  console.log("netProfit:", lastSaleAfter.netProfit);

  process.exit(0);
}

fixNetProfit();
