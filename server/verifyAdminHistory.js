import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import ProfitHistory from "./models/ProfitHistory.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  }
};

const verifyAdminHistory = async () => {
  try {
    await connectDB();

    const admin = await User.findOne({ role: "admin" });
    console.log(`\n👤 Admin: ${admin.name} (${admin.email})\n`);

    // Balance total por tipo
    const balance = await ProfitHistory.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(admin._id) } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log("💰 BALANCE POR TIPO:");
    let totalBalance = 0;
    for (const item of balance) {
      console.log(`   ${item._id}: $${item.total.toLocaleString('es-CO', { minimumFractionDigits: 3 })} (${item.count} transacciones)`);
      totalBalance += item.total;
    }
    console.log(`\n   TOTAL: $${totalBalance.toLocaleString('es-CO', { minimumFractionDigits: 3 })}`);

    // Últimas 10 transacciones
    const recent = await ProfitHistory.find({ user: admin._id })
      .sort({ date: -1 })
      .limit(10);

    console.log("\n\n📜 ÚLTIMAS 10 TRANSACCIONES:");
    for (const tx of recent) {
      const date = tx.date.toLocaleDateString('es-CO');
      const amount = tx.amount.toLocaleString('es-CO', { minimumFractionDigits: 3 });
      console.log(`   ${date} | ${tx.type.padEnd(15)} | +$${amount.padStart(12)} | ${tx.description}`);
    }

    console.log("\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

verifyAdminHistory();
