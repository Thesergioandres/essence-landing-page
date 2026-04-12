import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

async function checkSales() {
  try {
    const mongoUri =
      process.env.MONGO_URI_DEV_LOCAL ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/essence_local";

    await mongoose.connect(mongoUri);

    const sales = await Sale.find({})
      .select("saleId employee createdBy saleDate")
      .sort({ saleDate: -1 })
      .limit(10)
      .lean();

    console.log("Recent Sales:");
    sales.forEach((s) =>
      console.log(
        `  ${s.saleId} - employee: ${s.employee || "null"} - createdBy: ${s.createdBy || "null"}`,
      ),
    );

    const totalSales = await Sale.countDocuments();
    const distSales = await Sale.countDocuments({
      employee: { $exists: true, $ne: null },
    });

    console.log(
      `\nTotal: ${totalSales} sales, ${distSales} with employee field`,
    );

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkSales();
