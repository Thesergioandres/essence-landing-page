import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Business from "../models/Business.js";
import Credit from "../models/Credit.js";
import Customer from "../models/Customer.js";
import User from "../src/infrastructure/database/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGODB_URI_DEV_LOCAL ||
  "mongodb://localhost:27017/essence_vapes_dev";

const seedCredits = async () => {
  try {
    console.log("🔌 Connecting to DB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected");

    let user;
    let business = await Business.findOne();

    if (!business) {
      console.log("⚠️ No business found, creating dummy business structure...");

      const businessId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      try {
        user = await User.create({
          _id: userId,
          name: "Test User",
          email: `test_${Date.now()}@example.com`,
          password: "password123", // Fixed length
          business: businessId,
          role: "admin",
        });
      } catch (e) {
        console.log(
          "User creation failed, trying business first...",
          e.message,
        );
      }

      business = await Business.create({
        _id: businessId,
        name: "Test Business " + Date.now(),
        slug: "test-business-" + Date.now(),
        type: "retail",
        createdBy: userId, // required
        owner: userId,
      });

      if (!user) {
        user = await User.create({
          _id: userId,
          name: "Test User",
          email: `test_${Date.now()}@example.com`,
          password: "password123", // Fixed length
          business: businessId,
          role: "admin",
        });
      }
    } else {
      user = await User.findOne({ business: business._id });
      if (!user) {
        user = await User.create({
          name: "Test User",
          email: `test_${Date.now()}@example.com`,
          password: "password123", // Fixed length
          business: business._id,
          role: "admin",
        });
      }
    }

    let customer = await Customer.findOne({ business: business._id });
    if (!customer) {
      console.log("⚠️ No customer found, creating dummy customer...");
      customer = await Customer.create({
        name: "Test Customer",
        business: business._id,
        phone: "+573000000000",
        totalDebt: 0,
        createdBy: user._id,
      });
    }

    console.log(
      `🏢 Seeding for Business: ${business.name}, Customer: ${customer.name}`,
    );

    // Clean up old test credits - keep 200 for good measure
    await Credit.deleteMany({ description: /TEST_CREDIT_/ });

    const credits = [];
    const count = 200;

    for (let i = 0; i < count; i++) {
      const isOverdue = i % 2 === 0; // 50% overdue
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (isOverdue ? -10 : 10)); // 10 days ago or 10 days future

      credits.push({
        business: business._id,
        customer: customer._id,
        originalAmount: 100 + i,
        remainingAmount: 100 + i,
        paidAmount: 0,
        status: "pending",
        dueDate: dueDate,
        description: `TEST_CREDIT_${i}`,
        createdBy: user._id,
        statusHistory: [],
      });
    }

    await Credit.insertMany(credits);
    console.log(`✅ Successfully seeded ${count} credits.`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seedCredits();
