import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

async function debugAggregation() {
  try {
    const mongoUri =
      process.env.MONGO_URI_DEV_LOCAL ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/essence_local";

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const employeeId = "6980295759d41f4bb69d13d1";
    const businessId = "698021575c78b477eaa6d07d";

    const filter = {
      business: businessId,
      employee: employeeId,
    };

    console.log("\n🔍 Filter:", JSON.stringify(filter, null, 2));

    // Test 1: Count documents with filter
    const count = await Sale.countDocuments(filter);
    console.log(`\n📊 Found ${count} sales with filter`);

    // Test 2: Find one sale to inspect
    const sale = await Sale.findOne(filter).lean();
    if (sale) {
      console.log("\n📝 Sample sale:");
      console.log(`   ID: ${sale._id}`);
      console.log(`   saleId: ${sale.saleId}`);
      console.log(`   business: ${sale.business}`);
      console.log(`   employee: ${sale.employee}`);
      console.log(`   quantity: ${sale.quantity}`);
      console.log(`   salePrice: ${sale.salePrice}`);
      console.log(`   employeeProfit: ${sale.employeeProfit}`);
      console.log(`   totalProfit: ${sale.totalProfit}`);
    }

    // Test 3: Run aggregation
    const stats = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: {
            $sum: { $multiply: ["$salePrice", "$quantity"] },
          },
          totalEmployeeProfit: { $sum: "$employeeProfit" },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    console.log("\n📈 Aggregation result:", JSON.stringify(stats, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

debugAggregation();
