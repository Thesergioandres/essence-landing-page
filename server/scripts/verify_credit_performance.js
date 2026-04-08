import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGODB_URI_DEV_LOCAL ||
  "mongodb://localhost:27017/essence_vapes_dev";

// Mock Objects
const createMockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

const createMockReq = (businessId) => ({
  reqId: "TEST_REQ_" + Date.now(),
  businessId,
  query: { page: 1, limit: 100 },
  user: { id: "TEST_USER" },
});

const measure = async (name, fn) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return (end - start).toFixed(2);
};

const runVerification = async () => {
  try {
    console.log("🔌 Connecting to DB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected");

    // Dynamic imports to enforce order
    console.log("🔄 Loading models...");
    const User = (await import("../src/infrastructure/database/models/User.js")).default;
    const Customer = (await import("../models/Customer.js")).default;
    const Branch = (await import("../models/Branch.js")).default;
    const Credit = (await import("../models/Credit.js")).default;
    const { getCredits, getCreditsOptimized } =
      await import("../controllers/credit.controller.js");

    console.log("📋 Registered Models:", mongoose.modelNames());

    // 1. Find a business with credits
    const credit = await Credit.findOne();
    if (!credit) {
      console.log("⚠️ No credits found.");
      process.exit(0);
    }
    const businessId = credit.business;

    // 2. Measure Original
    console.log("\n🛑 Testing Original (N+1)...");
    const req1 = createMockReq(businessId);
    const res1 = createMockRes();
    const time1 = await measure("Original", async () => {
      await getCredits(req1, res1);
    });

    if (res1.statusCode && res1.statusCode !== 200) {
      console.error("❌ Original failed:", res1.data);
    } else {
      console.log(`⏱️ Original: ${time1}ms`);
    }

    // 3. Measure Optimized
    console.log("\n🚀 Testing Optimized...");
    const req2 = createMockReq(businessId);
    const res2 = createMockRes();
    const time2 = await measure("Optimized", async () => {
      await getCreditsOptimized(req2, res2);
    });

    if (res2.statusCode && res2.statusCode !== 200) {
      console.error("❌ Optimized failed:", res2.data?.message || res2.data);
    } else {
      console.log(`⏱️ Optimized: ${time2}ms`);
    }

    if (time1 && time2 && !res1.data?.message && !res2.data?.message) {
      const t1 = parseFloat(time1);
      const t2 = parseFloat(time2);
      const improvement = (((t1 - t2) / t1) * 100).toFixed(2);
      console.log(`\n🎉 Improvement: ${improvement}% faster!`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Script Error:", error);
    process.exit(1);
  }
};

runVerification();
