import fs from "fs";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Initialize environment manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  console.warn("[Essence Debug]", "Loading .env file...");
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
    console.warn("[Essence Debug]", "âœ… Connected to MongoDB");

    // 1. DEBUG PROMOTION PRICE PERSISTENCE
    console.warn("[Essence Debug]", "\n--- DEBUGGING PROMOTION ---");
    // Find the most recently updated promotion
    const promotion = await Promotion.findOne({}).sort({ updatedAt: -1 });

    if (promotion) {
      console.warn("[Essence Debug]", `Found Promotion: ${promotion.name} (${promotion._id})`);
      console.warn("[Essence Debug]", `Current employeePrice: ${promotion.employeePrice}`);
      console.warn("[Essence Debug]", `Current promotionPrice: ${promotion.promotionPrice}`);

      // Attempt update
      const newPrice = 17000;
      console.warn("[Essence Debug]", `Attempting to update employeePrice to ${newPrice}...`);

      // Explicitly set it
      const updateRes = await Promotion.updateOne(
        { _id: promotion._id },
        { $set: { employeePrice: newPrice } },
      );
      console.warn("[Essence Debug]", "Update Result:", updateRes);

      // Refetch to verify
      const updatedPromo = await Promotion.findById(promotion._id);
      console.warn("[Essence Debug]", 
        `Refetched employeePrice: ${updatedPromo.employeePrice}`,
      );

      if (updatedPromo.employeePrice === newPrice) {
        console.warn("[Essence Debug]", "âœ… Persistence Test PASSED via Mongoose updateOne");
      } else {
        console.warn("[Essence Debug]", "âŒ Persistence Test FAILED - Value reverted");
      }
    } else {
      console.warn("[Essence Debug]", "âŒ No promotions found");
    }

    // 2. DEBUG BRANCH STOCK VISIBILITY
    console.warn("[Essence Debug]", "\n--- DEBUGGING BRANCH STOCK ---");
    // Find a employee user
    const user = await User.findOne({ role: "empleado" });
    if (user) {
      console.warn("[Essence Debug]", `Checking for User: ${user.name} (${user._id})`);

      // Find Membership
      const membership = await Membership.findOne({
        user: user._id,
        status: "active",
      }).populate("allowedBranches");

      if (membership) {
        console.warn("[Essence Debug]", 
          `Detailed Membership found for business: ${membership.business}`,
        );
        console.warn("[Essence Debug]", `Allowed Branches: ${membership.allowedBranches.length}`);

        for (const branch of membership.allowedBranches) {
          console.warn("[Essence Debug]", 
            `\nChecking Branch: ${branch.name} (${branch._id}) IsWarehouse: ${branch.isWarehouse}`,
          );

          // Query Stock using the "Nuclear" Logic (No business filter)
          // Also remove Quantity filter to see if items exist at all
          const allStocks = await BranchStock.find({
            branch: branch._id,
          }).lean();

          console.warn("[Essence Debug]", 
            `Total items in BranchStock for this branch: ${allStocks.length}`,
          );

          const validStocks = allStocks.filter((s) => s.quantity > 0);
          console.warn("[Essence Debug]", `Items with quantity > 0: ${validStocks.length}`);

          if (validStocks.length > 0) {
            console.warn("[Essence Debug]", "Sample Valid Item:", validStocks[0]);
          } else if (allStocks.length > 0) {
            console.warn("[Essence Debug]", "Sample Zero/Negative Item:", allStocks[0]);
          }
        }
      } else {
        console.warn("[Essence Debug]", "âŒ No active membership found for this user");
      }
    } else {
      console.warn("[Essence Debug]", "âŒ No employee user found");
    }
  } catch (error) {
    console.error("âŒ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

run();

