import mongoose from "mongoose";
import ProfitHistory from "./models/ProfitHistory.js";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado");
  } catch (error) {
    console.error("❌ Error conectando MongoDB:", error);
    process.exit(1);
  }
};

const testProfitHistory = async () => {
  try {
    await connectDB();

    console.log("\n" + "=" .repeat(60));
    console.log("🧪 PRUEBA DEL MÓDULO DE HISTORIAL DE GANANCIAS");
    console.log("=" .repeat(60));

    // 1. Obtener todos los usuarios con historial
    const users = await User.find({
      role: { $in: ["admin", "distribuidor"] },
    }).select("name role");

    console.log(`\n📊 Usuarios en el sistema: ${users.length}\n`);

    // 2. Para cada usuario, mostrar su historial
    for (const user of users) {
      console.log("-" .repeat(60));
      console.log(`👤 ${user.name} (${user.role})`);
      console.log("-" .repeat(60));

      // Balance actual
      const balance = await ProfitHistory.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      let totalBalance = 0;
      console.log("\n💰 Balance por tipo:");
      for (const b of balance) {
        console.log(`  ${b._id}: $${b.total.toLocaleString()} (${b.count} transacciones)`);
        totalBalance += b.total;
      }
      console.log(`  ─────────────────────────`);
      console.log(`  TOTAL: $${totalBalance.toLocaleString()}\n`);

      // Últimas 5 transacciones
      const recentHistory = await ProfitHistory.find({ user: user._id })
        .sort({ date: -1 })
        .limit(5)
        .select("type amount date description balanceAfter");

      console.log("📜 Últimas 5 transacciones:");
      if (recentHistory.length === 0) {
        console.log("  (Sin transacciones)\n");
      } else {
        for (const entry of recentHistory) {
          const date = new Date(entry.date).toLocaleDateString("es-CO");
          console.log(
            `  ${date} | ${entry.type.padEnd(15)} | +$${entry.amount
              .toLocaleString()
              .padStart(10)} | Balance: $${entry.balanceAfter.toLocaleString()}`
          );
        }
        console.log("");
      }
    }

    // 3. Estadísticas generales
    console.log("\n" + "=" .repeat(60));
    console.log("📈 ESTADÍSTICAS GENERALES");
    console.log("=" .repeat(60) + "\n");

    const stats = await ProfitHistory.aggregate([
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    console.log("Por tipo de transacción:");
    let grandTotal = 0;
    for (const stat of stats) {
      console.log(`\n${stat._id}:`);
      console.log(`  Total: $${stat.totalAmount.toLocaleString()}`);
      console.log(`  Transacciones: ${stat.count}`);
      console.log(`  Promedio: $${stat.avgAmount.toLocaleString()}`);
      grandTotal += stat.totalAmount;
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`TOTAL GENERAL: $${grandTotal.toLocaleString()}`);

    // 4. Transacciones por mes
    const monthlyStats = await ProfitHistory.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    console.log(`\n\n📅 Transacciones por mes (últimos 6 meses):\n`);
    for (const stat of monthlyStats) {
      const monthName = new Date(stat._id.year, stat._id.month - 1).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
      });
      console.log(`${monthName}: $${stat.total.toLocaleString()} (${stat.count} transacciones)`);
    }

    // 5. Verificar integridad de balances
    console.log(`\n\n${"=" .repeat(60)}`);
    console.log("🔍 VERIFICACIÓN DE INTEGRIDAD");
    console.log("=" .repeat(60) + "\n");

    for (const user of users) {
      const entries = await ProfitHistory.find({ user: user._id }).sort({ date: 1 });

      if (entries.length === 0) continue;

      let calculatedBalance = 0;
      let errors = 0;

      for (const entry of entries) {
        calculatedBalance += entry.amount;
        const diff = Math.abs(calculatedBalance - entry.balanceAfter);

        if (diff > 0.01) {
          // Tolerancia de $0.01 por redondeo
          errors++;
        }
      }

      if (errors === 0) {
        console.log(`✅ ${user.name}: Balance correcto (${entries.length} entradas)`);
      } else {
        console.log(`⚠️  ${user.name}: ${errors} discrepancias encontradas`);
      }
    }

    console.log(`\n${"=" .repeat(60)}`);
    console.log("✅ Prueba completada");
    console.log("=" .repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error en prueba:", error);
    process.exit(1);
  }
};

testProfitHistory();
