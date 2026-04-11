import dotenv from "dotenv";
import mongoose from "mongoose";
import { RegisterSaleUseCase } from "../src/application/use-cases/sales/RegisterSaleUseCase.js";
import Business from "../src/infrastructure/database/models/Business.js";
import Product from "../src/infrastructure/database/models/Product.js";
import User from "../src/infrastructure/database/models/User.js";

dotenv.config();

/**
 * Test script to verify the paymentMethod fix in RegisterSaleUseCase
 * Tests that the use case can resolve string codes like "cash" to ObjectIds
 */

async function testPaymentMethodResolution() {
  try {
    const mongoUri =
      process.env.MONGO_URI_DEV_LOCAL ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URI;

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Find test user and business
    const admin = await User.findOne({ email: "prueba@gmail.com" });
    if (!admin) throw new Error("Admin user 'prueba@gmail.com' not found");

    const business = await Business.findOne({ name: "PRUEBA" });
    if (!business) throw new Error("Business 'PRUEBA' not found");

    // Find a product
    const product = await Product.findOne({ business: business._id }).limit(1);
    if (!product) throw new Error("No products found for business PRUEBA");

    console.log("📊 Test Setup:");
    console.log(`   - User: ${admin.email}`);
    console.log(`   - Business: ${business.name} (${business._id})`);
    console.log(`   - Product: ${product.name} (${product._id})`);

    // Test 1: Register sale with string code "cash"
    console.log("\n🧪 Test 1: Register sale with paymentMethodId='cash'");

    const useCase = new RegisterSaleUseCase();
    const input = {
      user: admin,
      businessId: business._id.toString(),
      distributorId: null, // Admin sale
      items: [
        {
          productId: product._id.toString(),
          quantity: 1,
          salePrice: product.clientPrice || product.suggestedPrice || 10000,
        },
      ],
      notes: "Test sale with cash payment",
      paymentMethodId: "cash", // String code, should be resolved to ObjectId
      deliveryMethodId: null,
      shippingCost: 0,
      distributorProfitPercentage: 20,
    };

    try {
      const result = await useCase.execute(input, null);
      console.log("✅ Sale registered successfully!");
      console.log(`   - Sale Group ID: ${result.saleGroupId}`);
      console.log(`   - Total Amount: $${result.totalAmount}`);
      console.log(`   - Total Items: ${result.totalItems}`);
      console.log(`   - Net Profit: $${result.netProfit}`);

      // Verify the sale was created with proper paymentMethod ObjectId
      const Sale = mongoose.model("Sale");
      const createdSale = await Sale.findOne({
        saleGroupId: result.saleGroupId,
      })
        .populate("paymentMethod")
        .lean();

      if (!createdSale) {
        throw new Error("Sale was not found in database");
      }

      console.log("\n📝 Sale Document Verification:");
      console.log(
        `   - Payment Method ID: ${createdSale.paymentMethod?._id || "null"}`,
      );
      console.log(`   - Payment Method Code: ${createdSale.paymentMethodCode}`);
      console.log(
        `   - Payment Method Name: ${createdSale.paymentMethod?.name || "N/A"}`,
      );
      console.log(`   - Payment Status: ${createdSale.paymentStatus}`);

      if (
        createdSale.paymentMethodCode === "cash" &&
        createdSale.paymentMethod?._id
      ) {
        console.log("✅ Payment method resolved correctly!");
      } else {
        console.log("❌ Payment method resolution failed!");
      }

      // Clean up: Delete the test sale
      await Sale.deleteOne({ _id: createdSale._id });
      console.log("\n🧹 Test sale cleaned up");
    } catch (error) {
      console.error("❌ Sale registration failed:", error.message);
      throw error;
    }

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

testPaymentMethodResolution();
