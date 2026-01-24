import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getSalesOptimized } from "../controllers/sale.controller.js";
import Business from "../models/Business.js"; // Ensure path is correct relative to script

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, "../.env") });

const verifyOptimization = async () => {
  try {
    console.log("🚀 Starting Verification Script...");

    // Connect to DB (Read-Only logical, but using dev connection string)
    // We are just reading.
    const mongoUri = process.env.MONGO_URI_DEV_LOCAL || process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("No MongoDB URI found");

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Get a valid Business ID
    const business = await Business.findOne();
    if (!business) throw new Error("No business found to test with");
    console.log(`🏢 Using Business: ${business.name} (${business._id})`);

    // Mock Request
    const req = {
      headers: { "x-business-id": business._id.toString() },
      query: { limit: "5" }, // Small limit for display, logic handles 50 default or whatever
    };

    // Mock Response
    let responseData = null;
    const res = {
      status: (code) => {
        if (code >= 400) console.error(`❌ Status Code: ${code}`);
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    console.log("⏱️ Executing getSalesOptimized...");
    const start = performance.now();
    await getSalesOptimized(req, res);
    const end = performance.now();

    if (!responseData) {
      throw new Error("No data received from controller");
    }

    console.log(`\n⚡ Execution Time: ${(end - start).toFixed(2)}ms`);

    if (responseData.performance) {
      console.log(
        `   (Internal Measure: ${responseData.performance.timeMs}ms)`,
      );
    }

    if (responseData.sales && responseData.sales.length > 0) {
      console.log("✅ Data received");
      console.log("📝 Sample Sale (lean + virtuals check):");
      const sample = responseData.sales[0];

      // Print interesting fields
      console.log(
        JSON.stringify(
          {
            id: sample._id,
            saleId: sample.saleId,
            total: sample.totalProfit,
            virtualsCheck: sample.id ? "Has ID virtual" : "No ID virtual",
          },
          null,
          2,
        ),
      );

      // Check for unnecessary fields (hydration check)
      if (sample instanceof mongoose.Model) {
        console.warn(
          "⚠️  Warning: Result is a Mongoose Document (Hydrated), not Lean!",
        );
      } else {
        console.log("✅ Result is POJO (Lean)");
      }
    } else {
      console.log("⚠️  No sales found for this business.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected");
    process.exit(0);
  }
};

verifyOptimization();
