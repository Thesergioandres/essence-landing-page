import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import GamificationConfig from "./models/GamificationConfig.js";
import DistributorStats from "./models/DistributorStats.js";
import PeriodWinner from "./models/PeriodWinner.js";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const checkGamification = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    // 1. Verificar configuración
    const config = await GamificationConfig.findOne();
    console.log("=== CONFIGURACIÓN ===");
    if (config) {
      console.log("Periodo de evaluación:", config.evaluationPeriod);
      console.log("Premio 1er lugar:", config.topPerformerBonus);
      console.log("Comisión extra top 1:", config.top1CommissionBonus + "%");
      console.log("Comisión extra top 2:", config.top2CommissionBonus + "%");
      console.log("Comisión extra top 3:", config.top3CommissionBonus + "%");
      console.log("Auto-evaluación:", config.autoEvaluate ? "Sí" : "No");
      console.log("Inicio periodo actual:", config.currentPeriodStart?.toLocaleDateString("es-CO") || "No definido");
    } else {
      console.log("❌ No hay configuración de gamificación");
    }

    // 2. Verificar periodo actual
    console.log("\n=== PERIODO ACTUAL ===");
    const now = new Date();
    let startDate, endDate;

    if (config?.evaluationPeriod === "biweekly") {
      startDate = config.currentPeriodStart || now;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 15);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    console.log("Inicio:", startDate.toLocaleDateString("es-CO"));
    console.log("Fin:", endDate.toLocaleDateString("es-CO"));

    // 3. Calcular ranking actual
    console.log("\n=== RANKING ACTUAL ===");
    const rankings = await Sale.aggregate([
      {
        $match: {
          distributor: { $exists: true, $ne: null },
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          totalUnits: { $sum: "$quantity" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    console.log(`Distribuidores con ventas: ${rankings.length}\n`);

    for (let i = 0; i < Math.min(rankings.length, 10); i++) {
      const rank = rankings[i];
      const user = await User.findById(rank._id);
      const position = i + 1;
      
      let bonusCommission = 0;
      if (position === 1) bonusCommission = config?.top1CommissionBonus || 0;
      else if (position === 2) bonusCommission = config?.top2CommissionBonus || 0;
      else if (position === 3) bonusCommission = config?.top3CommissionBonus || 0;

      const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : `#${position}`;

      console.log(`${medal} ${user?.name || "Desconocido"}`);
      console.log(`   Ventas: ${rank.totalSales} | Ingresos: $${rank.totalRevenue.toLocaleString()}`);
      console.log(`   Ganancia: $${rank.totalProfit.toLocaleString()} | Unidades: ${rank.totalUnits}`);
      if (bonusCommission > 0) {
        console.log(`   💰 +${bonusCommission}% comisión extra`);
      }
      console.log("");
    }

    // 4. Verificar estadísticas de distribuidores
    console.log("=== ESTADÍSTICAS DE DISTRIBUIDORES ===");
    const stats = await DistributorStats.find().populate("distributor");
    console.log(`Total distribuidores con estadísticas: ${stats.length}\n`);

    for (const stat of stats) {
      if (stat.distributor) {
        console.log(`👤 ${stat.distributor.name}`);
        console.log(`   Victorias: ${stat.periodWins}`);
        console.log(`   Top 3 finishes: ${stat.topThreeFinishes}`);
        console.log(`   Bonos ganados: $${stat.totalBonusEarned.toLocaleString()}`);
        console.log(`   Bonos pendientes: $${stat.pendingBonuses.toLocaleString()}`);
        console.log(`   Nivel actual: ${stat.currentLevel}`);
        console.log(`   Puntos: ${stat.totalPoints}`);
        console.log("");
      }
    }

    // 5. Historial de ganadores
    console.log("=== HISTORIAL DE GANADORES ===");
    const winners = await PeriodWinner.find().sort({ endDate: -1 }).limit(5);
    console.log(`Total periodos registrados: ${winners.length}\n`);

    for (const winner of winners) {
      console.log(`🏆 ${winner.winnerName} (${winner.periodType})`);
      console.log(`   Periodo: ${winner.startDate.toLocaleDateString("es-CO")} - ${winner.endDate.toLocaleDateString("es-CO")}`);
      console.log(`   Ventas: ${winner.salesCount} | Ingresos: $${winner.totalRevenue.toLocaleString()}`);
      console.log(`   Bono: $${winner.bonusAmount.toLocaleString()} | Pagado: ${winner.bonusPaid ? "Sí" : "No"}`);
      console.log("");
    }

    // 6. Verificar si hay ventas sin distribuidor
    const salesWithoutDist = await Sale.countDocuments({
      distributor: { $exists: false },
      paymentStatus: "confirmado",
    });
    
    const salesWithNullDist = await Sale.countDocuments({
      distributor: null,
      paymentStatus: "confirmado",
    });

    console.log("=== VERIFICACIÓN DE VENTAS ===");
    console.log(`Ventas sin campo distributor: ${salesWithoutDist}`);
    console.log(`Ventas con distributor = null: ${salesWithNullDist}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkGamification();
