import dotenv from "dotenv";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Category from "../models/Category.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import DistributorStock from "../models/DistributorStock.js";
import Expense from "../models/Expense.js";
import Product from "../src/infrastructure/database/models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";
import Stock from "../models/Stock.js";
import StockTransfer from "../models/StockTransfer.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const targetBusinessId = process.argv[2] || process.env.TARGET_BUSINESS_ID;

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

if (!targetBusinessId) {
  console.error(
    "❌ Falta el BUSINESS_ID. Usa: node scripts/fixMissingBusinessAll.js <BUSINESS_ID>"
  );
  process.exit(1);
}

const models = [
  { label: "AuditLog", Model: AuditLog },
  { label: "Category", Model: Category },
  { label: "DefectiveProduct", Model: DefectiveProduct },
  { label: "DistributorStock", Model: DistributorStock },
  { label: "Expense", Model: Expense },
  { label: "Product", Model: Product },
  { label: "ProfitHistory", Model: ProfitHistory },
  { label: "Sale", Model: Sale, perDoc: true },
  { label: "SpecialSale", Model: SpecialSale },
  { label: "Stock", Model: Stock },
  { label: "StockTransfer", Model: StockTransfer },
];

const missingBusinessQuery = {
  $or: [{ business: { $exists: false } }, { business: null }],
};

async function backfillBulk(label, Model, businessObjectId) {
  const res = await Model.updateMany(missingBusinessQuery, {
    $set: { business: businessObjectId },
  });
  console.log(
    `➡️  ${label}: matched=${res.matchedCount || 0}, modified=${
      res.modifiedCount || 0
    }`
  );
}

async function backfillPerDoc(label, Model, businessObjectId) {
  const docs = await Model.find(missingBusinessQuery).select("_id saleId");
  let modified = 0;
  let skipped = 0;

  for (const doc of docs) {
    try {
      const res = await Model.updateOne(
        { _id: doc._id },
        { $set: { business: businessObjectId } }
      );
      if (res.modifiedCount) modified += 1;
    } catch (err) {
      skipped += 1;
      console.error(
        `❌ ${label} ${doc._id} (${doc.saleId || "no-saleId"}) error: ${
          err.message
        }`
      );
    }
  }

  console.log(
    `➡️  ${label}: matched=${docs.length}, modified=${modified}, skipped=${skipped}`
  );
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  const businessObjectId = new mongoose.Types.ObjectId(targetBusinessId);

  for (const entry of models) {
    if (entry.perDoc) {
      await backfillPerDoc(entry.label, entry.Model, businessObjectId);
    } else {
      await backfillBulk(entry.label, entry.Model, businessObjectId);
    }
  }

  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

run().catch((err) => {
  console.error("❌ Error en la corrección:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
