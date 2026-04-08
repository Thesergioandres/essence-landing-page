import dotenv from "dotenv";
import mongoose from "mongoose";
import { SaleRepository } from "../src/infrastructure/database/repositories/SaleRepository.js";
// Import models to register schemas
import "../models/Branch.js";
import "../models/PaymentMethod.js";
import "../src/infrastructure/database/models/Product.js";
import "../src/infrastructure/database/models/User.js";

dotenv.config();

/**
 * Test script to verify distributor sales statistics calculation
 */

async function testDistributorStats() {
  try {
    const mongoUri =
      process.env.MONGO_URI_DEV_LOCAL ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/essence_local";

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const saleRepository = new SaleRepository();

    // Test for specific distributor (distribuidorprueba@gmail.com)
    const distributorId = "6980295759d41f4bb69d13d1";

    console.log("\n📊 Testing distributor stats:");
    console.log(`   Distributor ID: ${distributorId}`);

    const result = await saleRepository.list("698021575c78b477eaa6d07d", {
      distributorId,
      limit: 10,
    });

    console.log("\n📈 Statistics:");
    console.log(`   Total Sales: ${result.stats.totalSales}`);
    console.log(`   Total Revenue: $${result.stats.totalRevenue}`);
    console.log(
      `   Total Distributor Profit: $${result.stats.totalDistributorProfit}`,
    );
    console.log(`   Total Admin Profit: $${result.stats.totalAdminProfit}`);
    console.log(`   Total Profit: $${result.stats.totalProfit}`);

    console.log("\n🛒 Sales:");
    result.sales.forEach((sale) => {
      console.log(
        `   ${sale.saleId} - ${sale.quantity}x ${sale.productName || "Unknown"} - $${sale.salePrice} each = $${sale.salePrice * sale.quantity} - Profit: $${sale.distributorProfit}`,
      );
    });

    console.log("\n✅ Test completed!");
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testDistributorStats();
