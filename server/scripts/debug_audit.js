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
const createMockReq = (businessId, user) => ({
  reqId: "TEST_REQ_" + Date.now(),
  businessId,
  user: user || { id: "TEST_USER", role: "admin" },
  query: { page: 1, limit: 100 },
  ip: "127.0.0.1",
  connection: { remoteAddress: "127.0.0.1" },
  get: (header) => "mock-user-agent",
});

const run = async () => {
  try {
    console.log("🔌 Connecting to DB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected");

    console.log("Registering models...");
    const User = (await import("../src/infrastructure/database/models/User.js")).default;
    const Business = (await import("../models/Business.js")).default;
    const AuditLog = (await import("../models/AuditLog.js")).default;

    // Import AuditService
    console.log("Importing AuditService...");
    const AuditService = (await import("../services/audit.service.js")).default;
    console.log("Imported.");

    // Setup dummy data
    const business = await Business.findOne();
    const user = await User.findOne({ business: business._id });

    // Test Log
    console.log("Testing AuditService.log...");
    const req = createMockReq(business._id, user);

    await AuditService.log({
      user: user,
      action: "TEST_ACTION",
      module: "debug",
      description: "Test log",
      business: business._id,
      req: req,
    });
    console.log("✅ AuditService.log SUCCESS");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

run();
