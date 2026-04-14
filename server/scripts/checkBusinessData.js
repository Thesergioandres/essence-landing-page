import dotenv from "dotenv";
import mongoose from "mongoose";
import Business from "../src/infrastructure/database/models/Business.js";
import Category from "../src/infrastructure/database/models/Category.js";
import EmployeeStock from "../src/infrastructure/database/models/EmployeeStock.js";
import Expense from "../src/infrastructure/database/models/Expense.js";
import Product from "../src/infrastructure/database/models/Product.js";
import ProfitHistory from "../src/infrastructure/database/models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import SpecialSale from "../src/infrastructure/database/models/SpecialSale.js";
import Stock from "../src/infrastructure/database/models/Stock.js";
import StockTransfer from "../src/infrastructure/database/models/StockTransfer.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

const models = [
  ["Products", Product],
  ["Sales", Sale],
  ["ProfitHistory", ProfitHistory],
  ["Expenses", Expense],
  ["EmployeeStock", EmployeeStock],
  ["Stock", Stock],
  ["StockTransfer", StockTransfer],
  ["SpecialSale", SpecialSale],
  ["Category", Category],
];

async function analyzeModel(label, Model) {
  const missingQuery = {
    $or: [{ business: { $exists: false } }, { business: null }],
  };
  const missingCount = await Model.countDocuments(missingQuery);

  const perBusiness = await Model.aggregate([
    { $match: { business: { $exists: true, $ne: null } } },
    { $group: { _id: "$business", total: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 10 },
  ]);

  console.log(`\n== ${label} ==`);
  console.log(`  Sin business: ${missingCount}`);
  if (perBusiness.length === 0) {
    console.log("  Sin datos con business asignado");
  } else {
    console.log("  Top 10 por business:");
    perBusiness.forEach((row) => {
      console.log(`    ${row._id}: ${row.total}`);
    });
  }
}

async function main() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  const businessCount = await Business.countDocuments();
  console.log(`Negocios registrados: ${businessCount}`);

  for (const [label, model] of models) {
    await analyzeModel(label, model);
  }

  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

main().catch((err) => {
  console.error("❌ Error en el chequeo:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
