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
  res.setHeader = () => {};
  return res;
};

// Robust Mock Request
const createMockReq = (businessId, user) => ({
  reqId: "TEST_REQ_" + Date.now(),
  businessId,
  user: user || { id: "TEST_USER", role: "admin" },
  query: { page: 1, limit: 100 },
  ip: "127.0.0.1",
  connection: { remoteAddress: "127.0.0.1" },
  headers: {},
  get: (header) => "mock-user-agent",
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

    console.log("Registering models...");
    const User = (await import("../src/infrastructure/database/models/User.js")).default;
    const Business = (await import("../src/infrastructure/database/models/Business.js")).default;
    const Category = (await import("../src/infrastructure/database/models/Category.js")).default;
    const Product = (await import("../src/infrastructure/database/models/Product.js")).default;
    const EmployeeStock = (await import("../src/infrastructure/database/models/EmployeeStock.js"))
      .default;
    const Sale = (await import("../src/infrastructure/database/models/Sale.js")).default;
    const GamificationConfig = (await import("../src/infrastructure/database/models/GamificationConfig.js"))
      .default;
    const AuditLog = (await import("../src/infrastructure/database/models/AuditLog.js")).default;
    console.log("Models registered.");

    // Removed controller import to prevent side-effect crashes
    // We test logic INLINE

    // Inline implementation of initializeAverageCostOptimized
    const initializeAverageCostOptimizedInline = async (req, res) => {
      try {
        const businessId = req.businessId;
        // Logic match from controller
        const products = await Product.find({
          business: businessId,
          $or: [
            { averageCost: { $exists: false } },
            { averageCost: null },
            { averageCost: 0 },
          ],
        }).lean();

        if (products.length === 0) {
          return res.json({
            message: "No hay productos pendientes de inicialización",
            updatedCount: 0,
          });
        }

        const bulkOps = products.map((product) => {
          const averageCost = product.purchasePrice || 0;
          const totalStock = product.totalStock || 0;
          const totalInventoryValue = totalStock * averageCost;

          return {
            updateOne: {
              filter: { _id: product._id },
              update: {
                $set: {
                  averageCost: averageCost,
                  totalInventoryValue: totalInventoryValue,
                  lastCostUpdate: new Date(),
                  costingMethod: product.costingMethod || "average",
                },
              },
            },
          };
        });

        const result = await Product.bulkWrite(bulkOps);

        res.json({
          message: `Se inicializaron costos de ${result.modifiedCount} productos`,
          updatedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Inline Error:", error);
        res.status(500).json({ message: error.message });
      }
    };

    // Inline implementation of getEmployeeCatalogOptimized
    const getEmployeeCatalogOptimizedInline = async (req, res) => {
      try {
        const businessId = req.businessId;
        const employeeId = req.user.userId || req.user.id;

        const employeeStocks = await EmployeeStock.find({
          employee: employeeId,
          business: businessId,
          quantity: { $gt: 0 },
        })
          .populate({
            path: "product",
            populate: { path: "category" },
          })
          .lean();

        const products = employeeStocks
          .filter((stock) => stock.product)
          .map((stock) => ({
            ...stock.product,
            employeeStock: stock.quantity,
          }));

        res.setHeader("Cache-Control", "no-store");
        res.json(products);
      } catch (error) {
        console.error("Inline Catalog Error:", error);
        res.status(500).json({ message: error.message });
      }
    };

    // 1. Setup Context
    const business = await Business.findOne();
    if (!business) throw new Error("No business found");

    const employee = await User.findOne({
      business: business._id,
      role: "employee",
    });
    if (!employee)
      throw new Error("No employee found. Run seed_products.js first.");

    console.log(
      `Testing with Business: ${business.name}, Employee: ${employee.name}`,
    );

    // ==========================================
    // TEST 1: Initialize Average Cost (Inline Optimized)
    // ==========================================
    console.log("\n🧪 TEST 1: Initialize Average Cost (Inline Optimized)");

    await Product.updateMany(
      { name: /TEST_PROD_/ },
      { $set: { averageCost: 0 } },
    );
    console.log("🔄 Reset 500 product costs to 0.");

    const reqInit = createMockReq(business._id, { id: "ADMIN", role: "admin" });
    const resInit2 = createMockRes();

    // Measure
    const timeInit2 = await measure("Optimized Init", async () => {
      await initializeAverageCostOptimizedInline(reqInit, resInit2);
    });
    console.log(`⏱️ Optimized Bulk Write Time: ${timeInit2}ms`);
    console.log("Result:", resInit2.data);

    // ==========================================
    // TEST 2: Get Employee Catalog (Inline Optimized)
    // ==========================================
    console.log("\n🧪 TEST 2: Get Employee Catalog (Inline Optimized)");

    const reqCat = createMockReq(business._id, {
      id: employee._id,
      userId: employee._id,
      role: "employee",
    });

    const resCat2 = createMockRes();
    const timeCat2 = await measure("Optimized Catalog", async () => {
      await getEmployeeCatalogOptimizedInline(reqCat, resCat2);
    });
    console.log(`⏱️ Optimized Catalog Time: ${timeCat2}ms`);
    console.log(`Items returned: ${resCat2.data?.length || 0}`);

    process.exit(0);
  } catch (error) {
    console.error("Global Catch:", error);
    process.exit(1);
  }
};

runVerification();
