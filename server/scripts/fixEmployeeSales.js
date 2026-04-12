import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/infrastructure/database/models/User.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

/**
 * Migration script to fix employee field in sales
 *
 * Problem: Sales created by admin users were incorrectly setting
 * employee = admin.id, making all sales appear as employee sales.
 *
 * Solution: Remove employee field from sales where the employee
 * is actually an admin/superadmin user.
 */

async function fixEmployeeSales() {
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

    // Find all users who are admin/superadmin/god (non-employee roles)
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

    // Find sales where employee is set to an admin user
    const incorrectSales = await Sale.find({
      employee: { $in: adminIds },
    }).countDocuments();

    console.log(
      `🔍 Found ${incorrectSales} sales incorrectly marked as employee sales`,
    );

    if (incorrectSales === 0) {
      console.log("✅ No sales to fix. All good!");
      return;
    }

    // Update sales: set employee to null for admin sales
    const result = await Sale.updateMany(
      { employee: { $in: adminIds } },
      { $unset: { employee: "" } }, // Remove the field
    );

    console.log("\n📈 Migration Results:");
    console.log(`   - Modified: ${result.modifiedCount} sales`);
    console.log(`   - Matched: ${result.matchedCount} sales`);

    // Verify the fix
    const remainingIncorrect = await Sale.find({
      employee: { $in: adminIds },
    }).countDocuments();

    if (remainingIncorrect === 0) {
      console.log("\n✅ Migration completed successfully!");
      console.log("   All admin sales now have employee field removed");
    } else {
      console.log(
        `\n⚠️ Warning: ${remainingIncorrect} sales still have incorrect employee`,
      );
    }

    // Show statistics
    const totalSales = await Sale.countDocuments();
    const employeeSales = await Sale.countDocuments({
      employee: { $exists: true, $ne: null },
    });
    const adminSales = totalSales - employeeSales;

    console.log("\n📊 Final Statistics:");
    console.log(`   - Total Sales: ${totalSales}`);
    console.log(`   - Employee Sales: ${employeeSales}`);
    console.log(`   - Admin Sales: ${adminSales}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

fixEmployeeSales();
