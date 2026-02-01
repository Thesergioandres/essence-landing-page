import fs from "fs";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Initialize environment manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  console.log("Loading .env file...");
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

// Import Models
import BranchStock from "../server/models/BranchStock.js";
import Membership from "../server/models/Membership.js";
import Promotion from "../server/models/Promotion.js";
import User from "../server/models/User.js";

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("MONGO_URI not found in .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // 1. DEBUG PROMOTION PRICE PERSISTENCE
    console.log("\n--- DEBUGGING PROMOTION ---");
    // Find the most recently updated promotion
    const promotion = await Promotion.findOne({}).sort({ updatedAt: -1 });

    if (promotion) {
      console.log(`Found Promotion: ${promotion.name} (${promotion._id})`);
      console.log(`Current distributorPrice: ${promotion.distributorPrice}`);
      console.log(`Current promotionPrice: ${promotion.promotionPrice}`);

      // Attempt update
      const newPrice = 17000;
      console.log(`Attempting to update distributorPrice to ${newPrice}...`);

      // Explicitly set it
      const updateRes = await Promotion.updateOne(
        { _id: promotion._id },
        { $set: { distributorPrice: newPrice } },
      );
      console.log("Update Result:", updateRes);

      // Refetch to verify
      const updatedPromo = await Promotion.findById(promotion._id);
      console.log(
        `Refetched distributorPrice: ${updatedPromo.distributorPrice}`,
      );

      if (updatedPromo.distributorPrice === newPrice) {
        console.log("✅ Persistence Test PASSED via Mongoose updateOne");
      } else {
        console.log("❌ Persistence Test FAILED - Value reverted");
      }
    } else {
      console.log("❌ No promotions found");
    }

    // 2. DEBUG BRANCH STOCK VISIBILITY
    console.log("\n--- DEBUGGING BRANCH STOCK ---");
    // Find a distributor user
    const user = await User.findOne({ role: "distribuidor" });
    if (user) {
      console.log(`Checking for User: ${user.name} (${user._id})`);

      // Find Membership
      const membership = await Membership.findOne({
        user: user._id,
        status: "active",
      }).populate("allowedBranches");

      if (membership) {
        console.log(
          `Detailed Membership found for business: ${membership.business}`,
        );
        console.log(`Allowed Branches: ${membership.allowedBranches.length}`);

        for (const branch of membership.allowedBranches) {
          console.log(
            `\nChecking Branch: ${branch.name} (${branch._id}) IsWarehouse: ${branch.isWarehouse}`,
          );

          // Query Stock using the "Nuclear" Logic (No business filter)
          // Also remove Quantity filter to see if items exist at all
          const allStocks = await BranchStock.find({
            branch: branch._id,
          }).lean();

          console.log(
            `Total items in BranchStock for this branch: ${allStocks.length}`,
          );

          const validStocks = allStocks.filter((s) => s.quantity > 0);
          console.log(`Items with quantity > 0: ${validStocks.length}`);

          if (validStocks.length > 0) {
            console.log("Sample Valid Item:", validStocks[0]);
          } else if (allStocks.length > 0) {
            console.log("Sample Zero/Negative Item:", allStocks[0]);
          }
        }
      } else {
        console.log("❌ No active membership found for this user");
      }
    } else {
      console.log("❌ No distributor user found");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
