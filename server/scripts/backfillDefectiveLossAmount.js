import dotenv from "dotenv";
import mongoose from "mongoose";

import DefectiveProduct from "../src/infrastructure/database/models/DefectiveProduct.js";
import { DefectiveProductRepository } from "../src/infrastructure/database/repositories/DefectiveProductRepository.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function main() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI no esta definida en el entorno");
  }

  await mongoose.connect(mongoUri);

  const query = {
    status: "confirmado",
    hasWarranty: false,
    origin: { $ne: "customer_warranty" },
    $or: [{ lossAmount: { $exists: false } }, { lossAmount: { $lte: 0 } }],
  };

  const reports = await DefectiveProduct.find(query)
    .populate("product", "name purchasePrice averageCost")
    .lean();

  const repository = new DefectiveProductRepository();
  let updated = 0;
  let skipped = 0;

  for (const report of reports) {
    const product =
      report.product && typeof report.product === "object"
        ? report.product
        : null;
    const unitCost =
      toNumber(product?.averageCost) || toNumber(product?.purchasePrice) || 0;
    const quantity = toNumber(report.quantity || 0);

    if (!unitCost || !quantity) {
      skipped += 1;
      continue;
    }

    const lossAmount = unitCost * quantity;

    if (!DRY_RUN) {
      await DefectiveProduct.updateOne(
        { _id: report._id },
        { $set: { lossAmount } },
      );

      await repository.syncDefectiveProfitHistoryLoss(
        report.business,
        { ...report, lossAmount },
        lossAmount,
        product?.name,
      );
    }

    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: reports.length,
        updated,
        skipped,
        dryRun: DRY_RUN,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[backfillDefectiveLossAmount]", error);
  process.exit(1);
});
