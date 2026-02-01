import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "../models/Sale.js";

dotenv.config({ path: "server/.env" });

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || process.env.MONGO_URI_DEV_LOCAL,
    );
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

const inspectSales = async () => {
  await connectDB();

  try {
    // Fetch 3 most recent sales
    const sales = await Sale.find().sort({ saleDate: -1 }).limit(3).lean();

    console.log(`Found ${sales.length} sales. Inspecting fields...`);

    sales.forEach((sale, index) => {
      console.log(`\n--- SALE #${index + 1} (ID: ${sale.saleId}) ---`);
      console.log("Full Object:", JSON.stringify(sale, null, 2));

      // Search for 3000 in deep object
      const searchForValue = (obj, target) => {
        for (const [key, val] of Object.entries(obj)) {
          if (val == target)
            console.log(`>>> FOUND ${target} in field: ${key}`);
          if (typeof val === "object" && val !== null)
            searchForValue(val, target);
        }
      };
      searchForValue(sale, 3000);
    });
  } catch (error) {
    console.error("Error inspecting sales:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected.");
  }
};

inspectSales();
