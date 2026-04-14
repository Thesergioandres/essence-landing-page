import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Models
import "../src/infrastructure/database/models/Business.js";
import EmployeeStock from "../src/infrastructure/database/models/EmployeeStock.js";
import "../src/infrastructure/database/models/Product.js";
import Product from "../src/infrastructure/database/models/Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const employeeId = "6976ea761b2368c4bc66ff0f";
    const productNames = ["Vape Test Azul", "Esencia Test Roja"];

    console.log(`🔧 Restaurando stock para employee: ${employeeId}`);

    for (const name of productNames) {
      console.log(`\n🔎 Buscando producto: ${name}`);
      // Regex search for product
      const product = await Product.findOne({
        name: { $regex: name, $options: "i" },
      });

      if (!product) {
        console.log("   ❌ No encontrado en base de datos global de productos");
        continue;
      }

      console.log(`   ✅ ID: ${product._id}`);

      // Find or create EmployeeStock
      let stock = await EmployeeStock.findOne({
        employee: employeeId,
        product: product._id,
      });

      if (!stock) {
        console.log("   ⚠️ No tenía registro de stock. Creando...");
        stock = new EmployeeStock({
          employee: employeeId,
          product: product._id,
          business: product.business,
          quantity: 0,
        });
      }

      const oldQty = stock.quantity;
      stock.quantity = 10; // Restore to 10
      await stock.save();

      console.log(`   ✅ Stock actualizado: ${oldQty} -> 10`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Desconectado");
  }
}

run();
