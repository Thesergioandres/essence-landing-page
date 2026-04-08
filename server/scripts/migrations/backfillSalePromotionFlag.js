/**
 * Migration Script: Backfill Sale.isPromotion for historic sales
 *
 * Heuristic:
 * - If sale.discount > 0 => not promotion (treated as manual discount)
 * - Else, if sale.salePrice < product.clientPrice (or suggestedPrice) => promotion
 * - Else => not promotion
 *
 * Usage:
 *   cd server
 *   node scripts/migrations/backfillSalePromotionFlag.js [--dry-run] [--limit N] [--force]
 *
 * Options:
 *   --dry-run  Preview changes without updating
 *   --limit N  Limit number of sales to scan
 *   --force    Recompute even if isPromotion already set
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

let Sale;

async function loadModels() {
  await import("../../src/infrastructure/database/models/Product.js");
  const saleModule = await import("../../src/infrastructure/database/models/Sale.js");
  Sale = saleModule.default;
}

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
}

const limitArg = getArgValue("--limit");
const LIMIT = limitArg ? Number(limitArg) : null;

async function connectDB() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/essence";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");
}

function computePromotionFlag(sale) {
  const discount = Number(sale.discount || 0);
  if (discount > 0) return false;

  const product = sale.product;
  const normalPrice = product?.clientPrice ?? product?.suggestedPrice ?? null;

  if (normalPrice === null) return null;

  return sale.salePrice < normalPrice;
}

async function backfill() {
  if (!Sale) {
    throw new Error("Sale model not loaded. Call loadModels() first.");
  }
  console.log("\n========================================");
  console.log("Sale Promotion Flag Backfill");
  console.log("========================================");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Force: ${FORCE ? "YES" : "NO"}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log("========================================\n");

  const filter = FORCE
    ? {}
    : {
        $or: [{ isPromotion: { $exists: false } }, { isPromotion: null }],
      };

  let query = Sale.find(filter)
    .populate("product", "clientPrice suggestedPrice")
    .sort({ saleDate: -1, createdAt: -1 })
    .lean();

  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const sales = await query;

  console.log(`Found ${sales.length} sales to scan\n`);

  const stats = {
    scanned: 0,
    updatedTrue: 0,
    updatedFalse: 0,
    skippedNoPrice: 0,
    skippedUnchanged: 0,
    errors: 0,
  };

  for (const sale of sales) {
    try {
      const isPromotion = computePromotionFlag(sale);

      if (isPromotion === null) {
        stats.skippedNoPrice++;
        continue;
      }

      if (!FORCE && sale.isPromotion === isPromotion) {
        stats.skippedUnchanged++;
        continue;
      }

      if (!DRY_RUN) {
        await Sale.updateOne({ _id: sale._id }, { $set: { isPromotion } });
      }

      if (isPromotion) {
        stats.updatedTrue++;
      } else {
        stats.updatedFalse++;
      }

      stats.scanned++;

      if (stats.scanned % 200 === 0) {
        console.log(`  Processed ${stats.scanned}/${sales.length} sales...`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`Error on sale ${sale._id}:`, error.message);
    }
  }

  console.log("\n========================================");
  console.log("Backfill Summary");
  console.log("========================================");
  console.log(`Scanned: ${stats.scanned}`);
  console.log(`Updated (isPromotion=true): ${stats.updatedTrue}`);
  console.log(`Updated (isPromotion=false): ${stats.updatedFalse}`);
  console.log(`Skipped (no price data): ${stats.skippedNoPrice}`);
  console.log(`Skipped (unchanged): ${stats.skippedUnchanged}`);
  console.log(`Errors: ${stats.errors}`);
}

async function main() {
  await connectDB();
  await loadModels();
  await backfill();
  await mongoose.disconnect();
  console.log("\n✅ Done");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
