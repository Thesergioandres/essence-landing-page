/**
 * Migration Script: Backfill Sale.netProfit (admin net profit)
 *
 * Formula:
 *   netProfit = adminProfit - totalAdditionalCosts - shippingCost - discount
 *
 * Usage:
 *   cd server
 *   node scripts/migrations/backfillSaleNetProfit.js [--dry-run] [--limit N] [--force]
 *
 * Options:
 *   --dry-run  Preview changes without updating
 *   --limit N  Limit number of sales to scan
 *   --force    Recompute even if netProfit already set
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Sale from "../../src/infrastructure/database/models/Sale.js";

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

function computeNetProfit(sale) {
  const adminProfit = Number(sale.adminProfit || 0);
  const totalAdditionalCosts = Number(sale.totalAdditionalCosts || 0);
  const shippingCost = Number(sale.shippingCost || 0);
  const discount = Number(sale.discount || 0);
  return adminProfit - totalAdditionalCosts - shippingCost - discount;
}

async function backfill() {
  console.log("\n========================================");
  console.log("Sale NetProfit Backfill");
  console.log("========================================");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Force: ${FORCE ? "YES" : "NO"}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log("========================================\n");

  const filter = FORCE
    ? {}
    : {
        $or: [{ netProfit: { $exists: false } }, { netProfit: null }],
      };

  let query = Sale.find(filter).sort({ saleDate: -1, createdAt: -1 }).lean();

  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const sales = await query;
  console.log(`Found ${sales.length} sales to scan\n`);

  const stats = {
    scanned: 0,
    updated: 0,
    skippedUnchanged: 0,
    errors: 0,
  };

  for (const sale of sales) {
    try {
      const netProfit = computeNetProfit(sale);
      const currentNet = Number(sale.netProfit || 0);

      if (!FORCE && currentNet === netProfit) {
        stats.skippedUnchanged++;
        continue;
      }

      if (!DRY_RUN) {
        await Sale.updateOne({ _id: sale._id }, { $set: { netProfit } });
      }

      stats.updated++;
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
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped (unchanged): ${stats.skippedUnchanged}`);
  console.log(`Errors: ${stats.errors}`);
}

async function main() {
  await connectDB();
  await backfill();
  await mongoose.disconnect();
  console.log("\n✅ Done");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
