import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import User from "./models/User.js";
import GamificationConfig from "./models/GamificationConfig.js";
import dotenv from "dotenv";

dotenv.config();

const testWeeklyRankingLogic = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado\n");

    const config = await GamificationConfig.findOne();
    console.log("📊 CONFIGURACIÓN ACTUAL:");
    console.log("=".repeat(80));
    console.log(`Periodo: ${config.evaluationPeriod}`);
    console.log(`Requisito mínimo ganancia admin: $${config.minAdminProfitForRanking.toLocaleString('es-CO')}`);
    console.log(`Inicio periodo actual: ${config.currentPeriodStart.toLocaleDateString('es-CO')}`);
    console.log("=".repeat(80));

    // Calcular rango de la semana actual
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    console.log(`\n📅 PERIODO SEMANAL ACTUAL:`);
    console.log(`Inicio: ${startOfWeek.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    console.log(`Fin: ${endOfWeek.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);

    // Obtener ventas confirmadas de la semana con ganancia admin
    const weekSales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfWeek, $lte: endOfWeek },
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
      { $sort: { totalRevenue: -1 } },
    ]);

    console.log(`\n📊 VENTAS DE LA SEMANA (Total: ${weekSales.length} distribuidores):`);
    console.log("=".repeat(80));

    // Obtener info de distribuidores
    const distributorIds = weekSales.map(s => s._id);
    const distributors = await User.find({ _id: { $in: distributorIds } }).select('name email');
    const distributorMap = {};
    distributors.forEach(d => {
      distributorMap[d._id.toString()] = d.name;
    });

    for (const sale of weekSales) {
      const name = distributorMap[sale._id.toString()] || "Desconocido";
      const meetsRequirement = sale.totalAdminProfit >= config.minAdminProfitForRanking;
      const status = meetsRequirement ? "✅ CALIFICA" : "❌ NO CALIFICA";
      
      console.log(`\n${name}:`);
      console.log(`  Ingresos: $${sale.totalRevenue.toLocaleString('es-CO')}`);
      console.log(`  Ganancia Admin: $${sale.totalAdminProfit.toLocaleString('es-CO')}`);
      console.log(`  Ganancia Distribuidor: $${sale.totalDistributorProfit.toLocaleString('es-CO')}`);
      console.log(`  Ventas: ${sale.salesCount}`);
      console.log(`  Estado: ${status} ${meetsRequirement ? '' : `(necesita $${(config.minAdminProfitForRanking - sale.totalAdminProfit).toLocaleString('es-CO')} más)`}`);
    }

    // Filtrar solo los que califican
    const qualified = weekSales.filter(s => s.totalAdminProfit >= config.minAdminProfitForRanking);

    console.log("\n" + "=".repeat(80));
    console.log("🏆 RANKING SEMANAL (Solo califican con >= $100,000 ganancia admin):");
    console.log("=".repeat(80));

    if (qualified.length === 0) {
      console.log("❌ Ningún distribuidor cumple el requisito mínimo esta semana");
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
          badge = "📊 Normal";
          bonus = 0;
        }

        const percentage = 20 + bonus;

        console.log(`\n${badge} - ${name}`);
        console.log(`  Ingresos totales: $${dist.totalRevenue.toLocaleString('es-CO')}`);
        console.log(`  Ganancia generada al admin: $${dist.totalAdminProfit.toLocaleString('es-CO')}`);
        console.log(`  Comisión: ${percentage}% (20% base + ${bonus}% bonus)`);
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("📈 ESTADÍSTICAS:");
    console.log("=".repeat(80));
    console.log(`Total distribuidores con ventas: ${weekSales.length}`);
    console.log(`Distribuidores que califican: ${qualified.length}`);
    console.log(`Distribuidores sin calificar: ${weekSales.length - qualified.length}`);
    
    const totalRevenue = weekSales.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalAdminProfit = weekSales.reduce((sum, s) => sum + s.totalAdminProfit, 0);
    console.log(`Ingresos totales de la semana: $${totalRevenue.toLocaleString('es-CO')}`);
    console.log(`Ganancia admin total: $${totalAdminProfit.toLocaleString('es-CO')}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ VALIDACIÓN COMPLETADA");
    console.log("=".repeat(80));

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

testWeeklyRankingLogic();
