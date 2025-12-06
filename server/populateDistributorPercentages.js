import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import dotenv from "dotenv";

dotenv.config();

const populateDistributorPercentages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado");

    // Obtener todas las ventas
    const sales = await Sale.find({});
    console.log(`📊 Total de ventas encontradas: ${sales.length}`);

    let updatedCount = 0;
    let adminSalesCount = 0;
    let distributorSalesCount = 0;

    for (const sale of sales) {
      let newPercentage;

      // Si la venta no tiene distribuidor (es venta admin)
      if (!sale.distributor) {
        newPercentage = 0;
        adminSalesCount++;
      } else {
        // Ventas de distribuidor: 20% base + bonus
        const bonus = sale.commissionBonus || 0;
        newPercentage = 20 + bonus;
        distributorSalesCount++;
      }

      // Solo actualizar si el valor actual es diferente
      if (sale.distributorProfitPercentage !== newPercentage) {
        sale.distributorProfitPercentage = newPercentage;
        await sale.save();
        updatedCount++;

        const rankBadge = 
          newPercentage === 0 ? "👑 Admin" :
          newPercentage === 25 ? "🥇 1º (25%)" :
          newPercentage === 23 ? "🥈 2º (23%)" :
          newPercentage === 21 ? "🥉 3º (21%)" :
          "📊 Normal (20%)";

        console.log(`✅ Venta ${sale.saleId || sale._id}: ${rankBadge}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMEN DE MIGRACIÓN:");
    console.log("=".repeat(60));
    console.log(`Total ventas procesadas: ${sales.length}`);
    console.log(`Ventas actualizadas: ${updatedCount}`);
    console.log(`  - Ventas de admin: ${adminSalesCount}`);
    console.log(`  - Ventas de distribuidores: ${distributorSalesCount}`);
    console.log("=".repeat(60));

    // Mostrar distribución de rangos
    const rankDistribution = await Sale.aggregate([
      {
        $group: {
          _id: "$distributorProfitPercentage",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    console.log("\n📈 DISTRIBUCIÓN DE RANGOS:");
    console.log("=".repeat(60));
    rankDistribution.forEach((rank) => {
      const percentage = rank._id;
      const label =
        percentage === 0 ? "👑 Admin (0%)" :
        percentage === 25 ? "🥇 1º Lugar (25%)" :
        percentage === 23 ? "🥈 2º Lugar (23%)" :
        percentage === 21 ? "🥉 3º Lugar (21%)" :
        percentage === 20 ? "📊 Normal (20%)" :
        `❓ Otro (${percentage}%)`;
      
      console.log(`${label}: ${rank.count} ventas`);
    });
    console.log("=".repeat(60));

    await mongoose.connection.close();
    console.log("\n✅ Proceso completado. Conexión cerrada.");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

populateDistributorPercentages();
