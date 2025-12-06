import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import User from "./models/User.js";
import GamificationConfig from "./models/GamificationConfig.js";
import dotenv from "dotenv";

dotenv.config();

const testRankingWithHistory = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado\n");

    const config = await GamificationConfig.findOne();

    // Probar con todas las ventas históricas para ver quién calificaría
    console.log("📊 ANÁLISIS HISTÓRICO - Distribuidores por ganancia admin generada:");
    console.log("=".repeat(80));

    const allSales = await Sale.aggregate([
      {
        $match: {
          paymentStatus: "confirmado",
          distributor: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
          salesCount: { $sum: 1 },
        },
      },
      { $sort: { totalAdminProfit: -1 } },
    ]);

    const distributorIds = allSales.map(s => s._id);
    const distributors = await User.find({ _id: { $in: distributorIds } }).select('name email');
    const distributorMap = {};
    distributors.forEach(d => {
      distributorMap[d._id.toString()] = d.name;
    });

    console.log(`\nTotal distribuidores con ventas confirmadas: ${allSales.length}\n`);

    let qualifiedCount = 0;

    for (const dist of allSales) {
      const name = distributorMap[dist._id.toString()] || "Desconocido";
      const meetsRequirement = dist.totalAdminProfit >= config.minAdminProfitForRanking;
      const status = meetsRequirement ? "✅" : "❌";
      
      if (meetsRequirement) qualifiedCount++;

      console.log(`${status} ${name}:`);
      console.log(`   Ganancia Admin: $${dist.totalAdminProfit.toLocaleString('es-CO')}`);
      console.log(`   Ingresos: $${dist.totalRevenue.toLocaleString('es-CO')}`);
      console.log(`   Ventas: ${dist.salesCount}`);
      
      if (!meetsRequirement) {
        console.log(`   Necesita: $${(config.minAdminProfitForRanking - dist.totalAdminProfit).toLocaleString('es-CO')} más`);
      }
      console.log();
    }

    console.log("=".repeat(80));
    console.log("📈 RESUMEN:");
    console.log("=".repeat(80));
    console.log(`Total distribuidores: ${allSales.length}`);
    console.log(`Califican (>= $100,000 ganancia admin): ${qualifiedCount}`);
    console.log(`No califican: ${allSales.length - qualifiedCount}`);
    console.log(`Porcentaje que califica: ${((qualifiedCount / allSales.length) * 100).toFixed(1)}%`);

    // Simular ranking si todos tuvieran ventas en la misma semana
    console.log("\n" + "=".repeat(80));
    console.log("🏆 RANKING SIMULADO (si todas estas ventas fueran en la misma semana):");
    console.log("=".repeat(80));

    const qualified = allSales.filter(s => s.totalAdminProfit >= config.minAdminProfitForRanking);
    qualified.sort((a, b) => b.totalRevenue - a.totalRevenue);

    if (qualified.length === 0) {
      console.log("❌ Ninguno calificaría");
    } else {
      qualified.forEach((dist, index) => {
        const name = distributorMap[dist._id.toString()] || "Desconocido";
        let badge = "";
        let bonus = 0;

        if (index === 0) {
          badge = "🥇 1º LUGAR";
          bonus = config.top1CommissionBonus;
        } else if (index === 1) {
          badge = "🥈 2º LUGAR";
          bonus = config.top2CommissionBonus;
        } else if (index === 2) {
          badge = "🥉 3º LUGAR";
          bonus = config.top3CommissionBonus;
        } else {
          badge = `   ${index + 1}º lugar`;
          bonus = 0;
        }

        const percentage = 20 + bonus;

        console.log(`\n${badge} - ${name}`);
        console.log(`  Ingresos: $${dist.totalRevenue.toLocaleString('es-CO')}`);
        console.log(`  Ganancia admin: $${dist.totalAdminProfit.toLocaleString('es-CO')}`);
        console.log(`  Comisión: ${percentage}% (20% + ${bonus}%)`);
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("💡 CONCLUSIÓN:");
    console.log("=".repeat(80));
    console.log("El requisito de $100,000 en ganancia admin es un filtro importante.");
    console.log("Solo distribuidores que generen valor significativo al negocio");
    console.log("podrán acceder a las comisiones bonus del ranking.");
    console.log("=".repeat(80));

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

testRankingWithHistory();
