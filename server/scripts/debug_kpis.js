import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Sale from "../models/Sale.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

const debugKPIs = async () => {
  await connectDB();

  // Find the specific sale first to get its ID and Business
  const sale = await Sale.findOne({
    saleId: "VTA-2026-0001",
    salePrice: 20000,
  }).lean();
  if (!sale) {
    console.log("Sale not found");
    process.exit(0);
  }

  const businessId = sale.business;
  console.log("Testing aggregation for Business:", businessId);
  console.log("Sale ID:", sale._id);

  const pipeline = [
    { $match: { _id: sale._id } }, // Match ONLY this sale to isolate
    {
      $project: {
        opDate: 1,
        salePrice: 1,
        quantity: 1,
        purchasePrice: 1,
        averageCostAtSale: 1,
        shippingCost: 1,
        distributorProfit: 1,
        discount: 1,
        totalAdditionalCosts: 1,

        // Debug values
        costUsed: { $ifNull: ["$purchasePrice", "$averageCostAtSale", 0] },

        profit: {
          $subtract: [
            { $multiply: ["$salePrice", "$quantity"] },
            {
              $add: [
                {
                  $multiply: [
                    {
                      $ifNull: ["$purchasePrice", "$averageCostAtSale", 0],
                    },
                    "$quantity",
                  ],
                },
                {
                  $cond: {
                    if: {
                      $and: [
                        { $gt: ["$shippingCost", 710] },
                        { $lt: ["$shippingCost", 720] },
                      ],
                    },
                    then: 0,
                    else: { $ifNull: ["$shippingCost", 0] },
                  },
                },
                { $ifNull: ["$distributorProfit", 0] },
                { $ifNull: ["$discount", 0] },
                { $ifNull: ["$totalAdditionalCosts", 0] },
              ],
            },
          ],
        },
      },
    },
  ];

  const result = await Sale.aggregate(pipeline);
  console.log("Aggregation Result:", JSON.stringify(result, null, 2));

  process.exit(0);
};

debugKPIs();
