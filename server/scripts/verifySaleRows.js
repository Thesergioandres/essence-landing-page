import dotenv from "dotenv";
import mongoose from "mongoose";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

const saleIds = process.argv.slice(2);

if (!saleIds.length) {
  console.error("Uso: node scripts/verifySaleRows.js <SALE_ID...>");
  process.exit(1);
}

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
    const sales = await Sale.find({ saleId: { $in: saleIds } })
      .select(
        "saleId saleDate paymentStatus adminProfit distributorProfit totalProfit netProfit totalAdditionalCosts discount shippingCost distributor productName business",
      )
      .lean();

    const saleById = new Map(sales.map((s) => [s.saleId, s]));

    for (const saleId of saleIds) {
      const sale = saleById.get(saleId);
      const historyBySaleRef = sale
        ? await ProfitHistory.aggregate([
            {
              $match: {
                sale: sale._id,
              },
            },
            {
              $group: {
                _id: "$type",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ])
        : [];

      const historyByMetadataSaleId = await ProfitHistory.aggregate([
        {
          $match: {
            "metadata.saleId": saleId,
          },
        },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      console.log(`\\n${saleId}`);
      console.log(
        JSON.stringify(
          {
            sale: sale
              ? {
                  saleDate: sale.saleDate,
                  paymentStatus: sale.paymentStatus,
                  productName: sale.productName,
                  adminProfit: sale.adminProfit,
                  distributorProfit: sale.distributorProfit,
                  totalProfit: sale.totalProfit,
                  netProfit: sale.netProfit,
                  totalAdditionalCosts: sale.totalAdditionalCosts,
                  discount: sale.discount,
                  shippingCost: sale.shippingCost,
                  hasDistributor: Boolean(sale.distributor),
                }
              : null,
            profitHistoryBySaleRef: historyBySaleRef,
            profitHistoryByMetadataSaleId: historyByMetadataSaleId,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Error verifySaleRows:", error);
  process.exit(1);
});
