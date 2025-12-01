import { calculateDistributorPrice, getDistributorProfitPercentage } from "./utils/distributorPricing.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const testPricing = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    // IDs de ejemplo de tus distribuidores
    const distributors = [
      { id: "674324ed181f37e52b4fe24c", name: "Diego Gonzalez" },
      { id: "6743250d181f37e52b4fe253", name: "Maria Jose Rojas Losada" },
      { id: "67432528181f37e52b4fe25a", name: "Santiago salazar sanchez" },
      { id: "67432541181f37e52b4fe261", name: "Pedro Fabian León Sánchez" },
    ];

    const purchasePrice = 20000; // Ejemplo: producto de $20,000

    console.log("=== SISTEMA DE PRECIOS POR RANKING ===\n");
    console.log(`Precio de compra: $${purchasePrice.toLocaleString()}\n`);

    for (const dist of distributors) {
      const profitPercentage = await getDistributorProfitPercentage(dist.id);
      const distributorPrice = await calculateDistributorPrice(purchasePrice, dist.id);
      const estimatedProfit = distributorPrice - purchasePrice;

      console.log(`📊 ${dist.name}`);
      console.log(`   Porcentaje de ganancia: ${profitPercentage}%`);
      console.log(`   Precio de venta: $${distributorPrice.toLocaleString()}`);
      console.log(`   Ganancia estimada: $${estimatedProfit.toLocaleString()}`);
      console.log(`   Admin recibe: $${purchasePrice.toLocaleString()}`);
      console.log("");
    }

    console.log("\n=== EJEMPLO DE VENTA ===");
    const dist1 = distributors[0];
    const percentage = await getDistributorProfitPercentage(dist1.id);
    const price = await calculateDistributorPrice(purchasePrice, dist1.id);
    
    console.log(`\n${dist1.name} vende 1 unidad:`);
    console.log(`- Cobra al cliente: $${price.toLocaleString()}`);
    console.log(`- Su ganancia (${percentage}%): $${Math.round(price * percentage / 100).toLocaleString()}`);
    console.log(`- Envía al admin: $${(price - Math.round(price * percentage / 100)).toLocaleString()}`);
    console.log(`- Admin recibe: $${(price - Math.round(price * percentage / 100)).toLocaleString()}`);
    console.log(`- Costo del producto: $${purchasePrice.toLocaleString()}`);
    console.log(`- Ganancia admin: $${(price - Math.round(price * percentage / 100) - purchasePrice).toLocaleString()}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

testPricing();
