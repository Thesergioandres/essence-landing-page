import dotenv from "dotenv";
import mongoose from "mongoose";
import Business from "../models/Business.js";
import Category from "../models/Category.js";
import DistributorStock from "../models/DistributorStock.js";
import Expense from "../models/Expense.js";
import Membership from "../models/Membership.js";
import Product from "../src/infrastructure/database/models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";
import Stock from "../models/Stock.js";
import StockTransfer from "../models/StockTransfer.js";
import User from "../src/infrastructure/database/models/User.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const defaultBusinessName =
  process.env.DEFAULT_BUSINESS_NAME || "Default Business";

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

async function ensureBusiness(adminUserId) {
  let business = await Business.findOne({ name: defaultBusinessName });
  if (business) return business;

  business = await Business.create({
    name: defaultBusinessName,
    description: "Negocio creado durante la migración de multinegocio",
    createdBy: adminUserId,
    config: { features: {} },
  });

  console.log(`✅ Negocio creado: ${business.name}`);
  return business;
}

async function ensureMembership(userId, businessId, role) {
  const membership = await Membership.findOneAndUpdate(
    { user: userId, business: businessId },
    { role, status: "active" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✅ Membership ${role} asegurada para el usuario ${userId}`);
  return membership;
}

async function backfillModel(model, label, businessId) {
  const query = { $or: [{ business: { $exists: false } }, { business: null }] };
  const res = await model.updateMany(query, { $set: { business: businessId } });
  if (res.matchedCount || res.modifiedCount) {
    console.log(
      `➡️  ${label}: coincidencias ${res.matchedCount}, actualizadas ${res.modifiedCount}`
    );
  } else {
    console.log(`➡️  ${label}: sin documentos pendientes`);
  }
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  const adminUser =
    (await User.findOne({ role: "super_admin" })) ||
    (await User.findOne({ role: "admin" }));

  if (!adminUser) {
    throw new Error("No se encontró un usuario admin o super_admin");
  }

  const business = await ensureBusiness(adminUser._id);

  await ensureMembership(adminUser._id, business._id, "admin");

  const modelsToBackfill = [
    [Product, "Products"],
    [Sale, "Sales"],
    [ProfitHistory, "ProfitHistory"],
    [Expense, "Expenses"],
    [DistributorStock, "DistributorStock"],
    [Stock, "Stock"],
    [StockTransfer, "StockTransfer"],
    [SpecialSale, "SpecialSale"],
    [Category, "Category"],
  ];

  for (const [model, label] of modelsToBackfill) {
    await backfillModel(model, label, business._id);
  }

  console.log("✅ Backfill completado");
  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

run().catch((err) => {
  console.error("❌ Error en la migración:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
