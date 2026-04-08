import dotenv from "dotenv";
import mongoose from "mongoose";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGO_URI_PROD ||
  process.env.MONGO_URI_DEV_LOCAL;

if (!mongoUri) {
  console.error("No MONGODB_URI/MONGO_URI configurado");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(mongoUri);
  try {
    const totalSales = await Sale.countDocuments({});
    const febSales = await Sale.countDocuments({
      saleId: { $regex: "^SALE-202602" },
    });

    const recentSales = await Sale.find({})
      .select(
        "saleId saleDate productName adminProfit distributorProfit totalProfit",
      )
      .sort({ saleDate: -1 })
      .limit(10)
      .lean();

    const recentProfitMetadata = await ProfitHistory.aggregate([
      {
        $match: {
          "metadata.saleId": { $exists: true, $ne: null },
        },
      },
      { $sort: { date: -1, createdAt: -1 } },
      {
        $project: {
          _id: 0,
          saleId: "$metadata.saleId",
          amount: 1,
          type: 1,
          date: 1,
          eventName: "$metadata.eventName",
        },
      },
      { $limit: 10 },
    ]);

    console.log(
      JSON.stringify(
        {
          totalSales,
          febSales,
          recentSales,
          recentProfitMetadata,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Error inspectRecentSales:", error);
  process.exit(1);
});
