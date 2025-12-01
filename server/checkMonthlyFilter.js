import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import dotenv from "dotenv";

dotenv.config();

const checkMonthlyFilter = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const now = new Date();
    console.log("Fecha actual:", now.toLocaleString("es-CO"));
    console.log("");

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log("Start of Month:", startOfMonth.toLocaleString("es-CO"));
    console.log("End of Month:", endOfMonth.toLocaleString("es-CO"));
    console.log("");

    const currentMonthSales = await Sale.find({
      saleDate: { $gte: startOfMonth, $lte: endOfMonth },
      paymentStatus: "confirmado",
    });

    console.log("Ventas mes actual encontradas:", currentMonthSales.length);
    console.log("");

    let totalAdmin = 0;
    let totalDist = 0;

    currentMonthSales.forEach((s) => {
      totalAdmin += s.adminProfit;
      totalDist += s.distributorProfit;
      console.log(
        "  -",
        new Date(s.saleDate).toLocaleDateString("es-CO"),
        "| Admin:",
        s.adminProfit,
        "| Dist:",
        s.distributorProfit
      );
    });

    console.log("");
    console.log("TOTALES MES ACTUAL:");
    console.log("Admin:", totalAdmin);
    console.log("Dist:", totalDist);
    console.log("Total:", totalAdmin + totalDist);

    // Ahora revisar mes anterior
    console.log("\n=== MES ANTERIOR ===");
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    console.log("Start of Last Month:", startOfLastMonth.toLocaleString("es-CO"));
    console.log("End of Last Month:", endOfLastMonth.toLocaleString("es-CO"));
    console.log("");

    const lastMonthSales = await Sale.find({
      saleDate: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      paymentStatus: "confirmado",
    });

    console.log("Ventas mes anterior encontradas:", lastMonthSales.length);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkMonthlyFilter();
