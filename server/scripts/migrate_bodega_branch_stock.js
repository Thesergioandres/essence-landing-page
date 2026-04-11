import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import Branch from "../src/infrastructure/database/models/Branch.js";
import BranchStock from "../src/infrastructure/database/models/BranchStock.js";
import Product from "../src/infrastructure/database/models/Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const normalizeName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase();

async function run() {
  try {
    console.log("Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const bodegaBranches = await Branch.find({
      $or: [{ name: /^bodega$/i }, { isWarehouse: true }],
    }).lean();

    if (bodegaBranches.length === 0) {
      console.log("No se encontraron sedes Bodega.");
      return;
    }

    for (const branch of bodegaBranches) {
      const branchName = normalizeName(branch.name);
      console.log(`Procesando sede: ${branch.name} (${branch._id})`);

      const branchStocks = await BranchStock.find({
        branch: branch._id,
      }).lean();
      if (branchStocks.length === 0) {
        console.log("Sin registros de stock en esta sede.");
        continue;
      }

      const stockByProduct = new Map();
      branchStocks.forEach((entry) => {
        const productId = entry.product?.toString();
        if (!productId) return;
        stockByProduct.set(
          productId,
          (stockByProduct.get(productId) || 0) + (entry.quantity || 0),
        );
      });

      for (const [productId, quantity] of stockByProduct.entries()) {
        if (!quantity) continue;
        const product = await Product.findById(productId);
        if (!product) {
          console.log(`Producto no encontrado: ${productId}`);
          continue;
        }

        product.warehouseStock = (product.warehouseStock || 0) + quantity;
        await product.save();

        console.log(
          `- ${product.name}: +${quantity} a warehouseStock (total: ${product.warehouseStock})`,
        );
      }

      const deleteResult = await BranchStock.deleteMany({ branch: branch._id });
      console.log(
        `Eliminados ${deleteResult.deletedCount} registros de BranchStock para ${branchName}.`,
      );
    }
  } catch (error) {
    console.error("Error en migracion:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Desconectado.");
  }
}

run();
