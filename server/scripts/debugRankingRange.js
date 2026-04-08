import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

const business = process.argv[2];
const startArg = process.argv[3];
const endArg = process.argv[4];

if (!business || !startArg || !endArg) {
  console.error(
    "Uso: node scripts/debugRankingRange.js <businessId> <start ISO> <end ISO>"
  );
  process.exit(1);
}

const start = new Date(startArg);
const end = new Date(endArg);

const run = async () => {
  await connectDB();
  const rows = await Sale.aggregate([
    {
      $match: {
        business: new mongoose.Types.ObjectId(business),
        saleDate: { $gte: start, $lte: end },
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
  console.log(JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
