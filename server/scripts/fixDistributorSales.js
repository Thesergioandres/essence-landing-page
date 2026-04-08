import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/infrastructure/database/models/User.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

/**
 * Migration script to fix distributor field in sales
 *
 * Problem: Sales created by admin users were incorrectly setting
 * distributor = admin.id, making all sales appear as distributor sales.
 *
 * Solution: Remove distributor field from sales where the distributor
 * is actually an admin/superadmin user.
 */

async function fixDistributorSales() {
  try {
    const mongoUri =
      process.env.MONGO_URI_DEV_LOCAL ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        "No MongoDB URI found in environment variables. Check .env file.",
      );
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Find all users who are admin/superadmin/god (non-distributor roles)
    const adminUsers = await User.find({
      role: { $in: ["admin", "superadmin", "super_admin", "god"] },
    }).select("_id email role");

    console.log(`📊 Found ${adminUsers.length} admin users`);
    if (adminUsers.length > 0) {
      console.log(
        "   Admin users:",
        adminUsers.map((u) => `${u.email} (${u.role})`).join(", "),
      );
    }

    const adminIds = adminUsers.map((u) => u._id);

    // Find sales where distributor is set to an admin user
    const incorrectSales = await Sale.find({
      distributor: { $in: adminIds },
    }).countDocuments();

    console.log(
      `🔍 Found ${incorrectSales} sales incorrectly marked as distributor sales`,
    );

    if (incorrectSales === 0) {
      console.log("✅ No sales to fix. All good!");
      return;
    }

    // Update sales: set distributor to null for admin sales
    const result = await Sale.updateMany(
      { distributor: { $in: adminIds } },
      { $unset: { distributor: "" } }, // Remove the field
    );

    console.log("\n📈 Migration Results:");
    console.log(`   - Modified: ${result.modifiedCount} sales`);
    console.log(`   - Matched: ${result.matchedCount} sales`);

    // Verify the fix
    const remainingIncorrect = await Sale.find({
      distributor: { $in: adminIds },
    }).countDocuments();

    if (remainingIncorrect === 0) {
      console.log("\n✅ Migration completed successfully!");
      console.log("   All admin sales now have distributor field removed");
    } else {
      console.log(
        `\n⚠️ Warning: ${remainingIncorrect} sales still have incorrect distributor`,
      );
    }

    // Show statistics
    const totalSales = await Sale.countDocuments();
    const distributorSales = await Sale.countDocuments({
      distributor: { $exists: true, $ne: null },
    });
    const adminSales = totalSales - distributorSales;

    console.log("\n📊 Final Statistics:");
    console.log(`   - Total Sales: ${totalSales}`);
    console.log(`   - Distributor Sales: ${distributorSales}`);
    console.log(`   - Admin Sales: ${adminSales}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

fixDistributorSales();
