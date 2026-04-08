import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Models
import "../models/Business.js";
import DistributorStock from "../models/DistributorStock.js";
import "../src/infrastructure/database/models/Product.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import User from "../src/infrastructure/database/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const distributorId = "6976ea761b2368c4bc66ff0f"; // ID from previous logs

    console.log(`🔎 Inspeccionando Distribuidor: ${distributorId}`);

    const user = await User.findById(distributorId);
    console.log(`👤 Usuario: ${user ? user.name : "No encontrado"}`);

    // 1. Check Stock
    console.log("\n📦 STOCK ACTUAL:");
    const stocks = await DistributorStock.find({
      distributor: distributorId,
    }).populate("product", "name");
    if (stocks.length === 0) console.log("   (Vacío)");
    stocks.forEach((s) => {
      console.log(
        `   - ${s.product?.name || s.product} (ID: ${s.product?._id}): ${s.quantity} unds`,
      );
    });

    // 2. Check Recent Sales (Last 24h)
    console.log("\n🧾 VENTAS RECIENTES (Últimas 24h):");
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const sales = await Sale.find({
      distributor: distributorId,
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });

    if (sales.length === 0) console.log("   (Ninguna venta reciente)");

    sales.forEach((s) => {
      // Shorten output
      console.log(
        `SALE: ${s.productName} | Qty: ${s.quantity} | Total: ${s.salePrice * s.quantity}`,
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Desconectado");
  }
}

run();
