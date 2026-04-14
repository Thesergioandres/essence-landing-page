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

const seedProducts = async () => {
  try {
    console.log("🔌 Connecting to DB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected");

    // Dynamic imports to avoid schema issues
    const User = (await import("../src/infrastructure/database/models/User.js")).default;
    const Product = (
      await import("../src/infrastructure/database/models/Product.js")
    ).default;
    const Business = (await import("../src/infrastructure/database/models/Business.js")).default;
    const EmployeeStock = (await import("../src/infrastructure/database/models/EmployeeStock.js"))
      .default;
    const Category = (await import("../src/infrastructure/database/models/Category.js")).default; // Need category for product

    // 1. Setup Business & User
    let business = await Business.findOne();
    if (!business) {
      // ... (Reuse robust creation logic if needed, but assuming Credit seed ran, it exists)
      console.log(
        "⚠️ No business found, please run seed_credits.js first or create manually.",
      );
      process.exit(1);
    }

    let admin = await User.findOne({ business: business._id, role: "admin" });

    // 2. Create Employee
    let employee = await User.findOne({
      business: business._id,
      role: "employee",
    });
    if (!employee) {
      console.log("Creating dummy employee...");
      employee = await User.create({
        name: "Test Employee",
        email: `employee_${Date.now()}@test.com`,
        password: "password123",
        business: business._id,
        role: "employee",
      });
    }

    // 3. Create Category
    let category = await Category.findOne({ business: business._id });
    if (!category) {
      category = await Category.create({
        name: "Test Category",
        slug: "test-category",
        business: business._id,
        createdBy: admin?._id,
      });
    }

    // 4. Seed Products (Target: 500 products to test bulk write)
    console.log("🌱 Seeding 500 products...");
    // Cleanup first
    await Product.deleteMany({ name: /TEST_PROD_/ });

    const products = [];
    const count = 500;

    for (let i = 0; i < count; i++) {
      products.push({
        business: business._id,
        name: `TEST_PROD_${i}`,
        description: "Test description",
        purchasePrice: 10 + i,
        clientPrice: 20 + i,
        employeePrice: 15 + i,
        suggestedPrice: 25 + i,
        totalStock: 100,
        warehouseStock: 100,
        category: category._id,
        // Intentionally missing averageCost or 0 to trigger update logic
        averageCost: 0,
      });
    }

    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Seeded ${createdProducts.length} products.`);

    // 5. Seed Employee Stock (Target: 500 stocks to test catalog)
    console.log("🌱 Seeding employee stock...");
    await EmployeeStock.deleteMany({ employee: employee._id });

    const stocks = createdProducts.map((p) => ({
      employee: employee._id,
      business: business._id,
      product: p._id,
      quantity: 10, // Positive quantity
    }));

    await EmployeeStock.insertMany(stocks);
    console.log(`✅ Seeded ${stocks.length} employee stock entries.`);

    console.log("Done.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seedProducts();
