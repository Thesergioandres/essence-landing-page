import dotenv from "dotenv";
import mongoose from "mongoose";

import DefectiveProduct from "../src/infrastructure/database/models/DefectiveProduct.js";
import Membership from "../src/infrastructure/database/models/Membership.js";
import Product from "../src/infrastructure/database/models/Product.js";
import ProfitHistory from "../src/infrastructure/database/models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getOriginalNetProfit = (saleItem, quantity) => {
  const saleQuantity = toNumber(saleItem.quantity || 1) || 1;
  const quantityRatio = saleQuantity > 0 ? quantity / saleQuantity : 1;
  const originalUnitPrice = toNumber(saleItem.salePrice);
  const originalUnitCost =
    saleItem.averageCostAtSale ||
    saleItem.purchasePrice ||
    saleItem.product?.averageCost ||
    saleItem.product?.purchasePrice ||
    0;
  const perUnitAdditionalCosts =
    toNumber(saleItem.totalAdditionalCosts) / saleQuantity;
  const perUnitShipping = toNumber(saleItem.shippingCost) / saleQuantity;
  const perUnitDiscount = toNumber(saleItem.discount) / saleQuantity;
  const computed =
    (originalUnitPrice -
      originalUnitCost -
      perUnitAdditionalCosts -
      perUnitShipping -
      perUnitDiscount) *
    quantity;

  if (Number.isFinite(saleItem.netProfit)) {
    return toNumber(saleItem.netProfit) * quantityRatio;
  }

  return computed;
};

const getReplacementNetProfit = (
  replacementPrice,
  replacementProduct,
  quantity,
) => {
  const unitCost =
    replacementProduct?.averageCost || replacementProduct?.purchasePrice || 0;
  return (replacementPrice - unitCost) * quantity;
};

async function main() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI no esta definida en el entorno");
  }

  await mongoose.connect(mongoUri);

  const reports = await DefectiveProduct.find({ origin: "customer_warranty" })
    .sort({ createdAt: 1 })
    .lean();

  const adminCache = new Map();
  let updated = 0;
  let skipped = 0;

  for (const report of reports) {
    const quantity =
      toNumber(report.replacementQuantity || report.quantity || 1) || 1;

    const [saleItem, replacementProduct] = await Promise.all([
      report.originalSaleItem
        ? Sale.findById(report.originalSaleItem)
            .populate("product", "purchasePrice averageCost")
            .lean()
        : null,
      report.replacementProduct
        ? Product.findById(report.replacementProduct).lean()
        : null,
    ]);

    if (!saleItem || !replacementProduct) {
      skipped++;
      continue;
    }

    const replacementPrice = toNumber(report.replacementPrice || 0);
    const originalNetProfit = getOriginalNetProfit(saleItem, quantity);
    const replacementNetProfit = getReplacementNetProfit(
      replacementPrice,
      replacementProduct,
      quantity,
    );

    const originalTotal = toNumber(saleItem.salePrice) * quantity;
    const replacementTotal = replacementPrice * quantity;
    const priceDifference = Math.max(0, replacementTotal - originalTotal);
    const cashRefund = Math.max(0, originalTotal - replacementTotal);

    const updatePayload = {
      lossAmount: originalNetProfit - replacementNetProfit,
      replacementTotal,
      priceDifference,
      cashRefund,
    };

    if (!DRY_RUN) {
      await DefectiveProduct.updateOne(
        { _id: report._id },
        { $set: updatePayload },
      );
    }

    if (report.upsellSale) {
      if (!DRY_RUN) {
        await Sale.updateOne(
          { _id: report.upsellSale },
          {
            $set: {
              salePrice: 0,
              actualPayment: 0,
              discount: 0,
              adminProfit: 0,
              distributorProfit: 0,
              totalProfit: 0,
              totalGroupProfit: 0,
              netProfit: 0,
              totalAdditionalCosts: 0,
            },
          },
        );

        await ProfitHistory.deleteMany({ sale: report.upsellSale });
      }
    }

    const businessId = report.business?.toString();
    if (businessId) {
      let adminUserId = adminCache.get(businessId);
      if (adminUserId === undefined) {
        const adminMembership = await Membership.findOne({
          business: report.business,
          role: "admin",
          status: "active",
        })
          .select("user")
          .lean();
        adminUserId = adminMembership?.user || null;
        adminCache.set(businessId, adminUserId);
      }

      if (adminUserId) {
        const alreadyAdjusted = await ProfitHistory.findOne({
          business: report.business,
          user: adminUserId,
          "metadata.eventName": "warranty_profit_adjustment",
          "metadata.ticketId": report.ticketId,
        })
          .select("_id")
          .lean();

        if (!alreadyAdjusted) {
          const metadata = {
            quantity,
            ticketId: report.ticketId,
            eventName: "warranty_profit_adjustment",
            originalSaleId: report.originalSaleId,
            originalSaleGroupId: report.originalSaleGroupId,
            originalNetProfit,
            replacementNetProfit,
            priceDifference,
            cashRefund,
          };

          const entries = [];
          if (originalNetProfit !== 0) {
            entries.push({
              business: report.business,
              user: adminUserId,
              type: "ajuste",
              amount: -originalNetProfit,
              sale: saleItem._id,
              product: saleItem.product,
              description: `Reverso ganancia venta original (${report.ticketId})`,
              date: new Date(),
              metadata,
            });
          }
          if (replacementNetProfit !== 0) {
            entries.push({
              business: report.business,
              user: adminUserId,
              type: "ajuste",
              amount: replacementNetProfit,
              sale: saleItem._id,
              product: replacementProduct._id,
              description: `Ganancia ajustada por garantia (${report.ticketId})`,
              date: new Date(),
              metadata,
            });
          }

          if (!DRY_RUN && entries.length > 0) {
            await ProfitHistory.insertMany(entries);
          }
        }
      }
    }

    updated++;
  }

  console.log("\nBackfill garantias completado");
  console.log({ scanned: reports.length, updated, skipped, dryRun: DRY_RUN });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Error en backfill:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
