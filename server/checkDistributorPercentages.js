import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import dotenv from "dotenv";

dotenv.config();

const checkDistributorPercentages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado");

    // Obtener todas las ventas sin populate
    const sales = await Sale.find({}).select('saleId distributor commissionBonus distributorProfitPercentage');
    
    console.log(`\n📊 Total de ventas: ${sales.length}\n`);
    console.log("=".repeat(80));
    console.log("ID Venta".padEnd(20), "Distribuidor".padEnd(12), "Bonus".padEnd(8), "Porcentaje".padEnd(12), "Estado");
    console.log("=".repeat(80));

    let nullCount = 0;
    let validCount = 0;
    let invalidCount = 0;

    for (const sale of sales) {
      const saleId = sale.saleId || "Sin ID";
      const hasDistributor = sale.distributor ? "Sí" : "Admin";
      const bonus = sale.commissionBonus !== undefined ? sale.commissionBonus : "undefined";
      const percentage = sale.distributorProfitPercentage !== undefined ? sale.distributorProfitPercentage : "null";
      
      // Validar coherencia
      let status = "✅";
      if (percentage === "null") {
        status = "❌ NULL";
        nullCount++;
      } else if (!sale.distributor && percentage !== 0) {
        status = "⚠️ Admin con %";
        invalidCount++;
      } else if (sale.distributor && ![20, 21, 22, 23, 25].includes(percentage)) {
        status = "⚠️ % inválido";
        invalidCount++;
      } else {
        validCount++;
      }

      console.log(
        saleId.toString().padEnd(20),
        hasDistributor.padEnd(12),
        bonus.toString().padEnd(8),
        percentage.toString().padEnd(12),
        status
      );
    }

    console.log("=".repeat(80));
    console.log(`\n📊 RESUMEN:`);
    console.log(`  ✅ Ventas válidas: ${validCount}`);
    console.log(`  ❌ Ventas con NULL: ${nullCount}`);
    console.log(`  ⚠️  Ventas con valores inválidos: ${invalidCount}`);
    console.log(`  📊 Total: ${sales.length}`);

    // Buscar las ventas con NULL para corregir
    if (nullCount > 0) {
      console.log("\n🔍 Ventas con distributorProfitPercentage = NULL:");
      const nullSales = sales.filter(s => s.distributorProfitPercentage === undefined || s.distributorProfitPercentage === null);
      for (const sale of nullSales) {
        const bonus = sale.commissionBonus || 0;
        const expectedPercentage = sale.distributor ? (20 + bonus) : 0;
        console.log(`  - ${sale.saleId}: bonus=${bonus}, debería ser ${expectedPercentage}%`);
      }
    }

    await mongoose.connection.close();
    console.log("\n✅ Conexión cerrada.");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkDistributorPercentages();
