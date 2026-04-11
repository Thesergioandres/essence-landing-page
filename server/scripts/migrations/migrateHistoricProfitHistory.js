/**
 * Migration Script: Generate ProfitHistory entries for historic sales
 *
 * This script creates ProfitHistory entries for existing confirmed sales
 * that don't already have entries in the ProfitHistory collection.
 *
 * Usage:
 *   cd server
 *   node scripts/migrations/migrateHistoricProfitHistory.js [--dry-run]
 *
 * Options:
 *   --dry-run  Preview changes without actually creating entries
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Import models
import Membership from "../../src/infrastructure/database/models/Membership.js";
import ProfitHistory from "../../src/infrastructure/database/models/ProfitHistory.js";
import Sale from "../../src/infrastructure/database/models/Sale.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function connectDB() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/essence";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");
}

async function getAdminForBusiness(businessId) {
  const adminMembership = await Membership.findOne({
    business: businessId,
    role: "admin",
    status: "active",
  })
    .select("user")
    .lean();

  return adminMembership?.user;
}

async function migrateHistoricProfitHistory() {
  console.log("\n========================================");
  console.log("ProfitHistory Migration Script");
  console.log("========================================");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE"}`,
  );
  console.log("========================================\n");

  // Find all confirmed sales (not credit) that don't have ProfitHistory entries
  const existingProfitHistorySales = await ProfitHistory.distinct("sale");

  console.log(
    `Found ${existingProfitHistorySales.length} sales with existing ProfitHistory entries`,
  );

  // Get all confirmed sales that don't have ProfitHistory entries
  // Note: paymentStatus can be "confirmado" (Spanish) or "confirmed"/"completed" (English)
  const salesWithoutHistory = await Sale.find({
    _id: { $nin: existingProfitHistorySales },
    paymentStatus: { $in: ["confirmed", "completed", "confirmado", "paid"] },
  })
    .sort({ saleDate: -1 })
    .lean();

  console.log(
    `Found ${salesWithoutHistory.length} confirmed sales without ProfitHistory entries\n`,
  );

  if (salesWithoutHistory.length === 0) {
    console.log(
      "✅ No sales need migration. All sales already have ProfitHistory entries.",
    );
    return;
  }

  const stats = {
    salesProcessed: 0,
    distributorEntriesCreated: 0,
    adminEntriesCreated: 0,
    errors: [],
    skippedNoProfit: 0,
    skippedNoAdmin: 0,
  };

  // Cache admins by business
  const adminCache = new Map();

  for (const sale of salesWithoutHistory) {
    try {
      const businessId = sale.business;
      const saleDate = sale.saleDate || sale.createdAt;

      // Get admin for this business (cached)
      let adminUserId = adminCache.get(businessId?.toString());
      if (adminUserId === undefined) {
        adminUserId = await getAdminForBusiness(businessId);
        adminCache.set(businessId?.toString(), adminUserId || null);
      }

      // Sale model has single product, not products array
      const productId = sale.product;
      const quantity = sale.quantity || 1;
      const salePrice = sale.salePrice || 0;
      const distributorId = sale.distributor;
      const distributorProfit = sale.distributorProfit || 0;
      const adminProfit = sale.adminProfit || 0;
      const totalProfit = sale.totalProfit || 0;

      // Create entry for distributor's profit
      if (distributorId && distributorProfit > 0) {
        if (!DRY_RUN) {
          await ProfitHistory.create({
            business: businessId,
            user: distributorId,
            type: "venta_normal",
            amount: distributorProfit,
            sale: sale._id,
            product: productId,
            description: `Comisión por venta ${sale.saleId} (migración)`,
            date: saleDate,
            metadata: {
              quantity,
              salePrice,
              saleId: sale.saleId,
              migratedAt: new Date(),
            },
          });
        }
        stats.distributorEntriesCreated++;
      }

      // Create entry for admin's profit
      if (adminProfit > 0 || (totalProfit > 0 && !distributorId)) {
        const profitAmount = adminProfit > 0 ? adminProfit : totalProfit;

        if (adminUserId) {
          if (!DRY_RUN) {
            await ProfitHistory.create({
              business: businessId,
              user: adminUserId,
              type: "venta_normal",
              amount: profitAmount,
              sale: sale._id,
              product: productId,
              description: distributorId
                ? `Ganancia de venta ${sale.saleId} (distribuidor - migración)`
                : `Venta directa ${sale.saleId} (migración)`,
              date: saleDate,
              metadata: {
                quantity,
                salePrice,
                saleId: sale.saleId,
                migratedAt: new Date(),
              },
            });
          }
          stats.adminEntriesCreated++;
        } else {
          stats.skippedNoAdmin++;
        }
      } else if (
        totalProfit === 0 &&
        adminProfit === 0 &&
        distributorProfit === 0
      ) {
        stats.skippedNoProfit++;
      }

      stats.salesProcessed++;

      // Progress indicator
      if (stats.salesProcessed % 100 === 0) {
        console.log(
          `  Processed ${stats.salesProcessed}/${salesWithoutHistory.length} sales...`,
        );
      }
    } catch (error) {
      stats.errors.push({
        saleId: sale.saleId,
        error: error.message,
      });
    }
  }

  // Print summary
  console.log("\n========================================");
  console.log("Migration Summary");
  console.log("========================================");
  console.log(`Sales processed: ${stats.salesProcessed}`);
  console.log(
    `Distributor entries ${DRY_RUN ? "to create" : "created"}: ${stats.distributorEntriesCreated}`,
  );
  console.log(
    `Admin entries ${DRY_RUN ? "to create" : "created"}: ${stats.adminEntriesCreated}`,
  );
  console.log(`Skipped (no profit): ${stats.skippedNoProfit}`);
  console.log(`Skipped (no admin found): ${stats.skippedNoAdmin}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log("\nErrors:");
    stats.errors.slice(0, 10).forEach((e) => {
      console.log(`  - Sale ${e.saleId}: ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  if (DRY_RUN) {
    console.log(
      "\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply changes.",
    );
  } else {
    console.log("\n✅ Migration completed successfully!");
  }
}

async function main() {
  try {
    await connectDB();
    await migrateHistoricProfitHistory();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  }
}

main();
