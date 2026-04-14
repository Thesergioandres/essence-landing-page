import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Models
import Product from "../src/infrastructure/database/models/Product.js";
import Promotion from "../src/infrastructure/database/models/Promotion.js";

// Utils
import {
  getEmployeeCommissionInfo,
  getEmployeeProfitPercentage,
} from "../src/infrastructure/services/employeePricing.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const DEBUG = true;

async function run() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado");

    const productId = "6978760426b16fc40a219adf";
    const employeeId = "6976ea761b2368c4bc66ff0f";

    // Buscar Business ID (asumimos el primero que encontremos o intentamos deducir)
    // Buscamos si el producto existe para sacar el business
    let businessId = null;

    // 1. Buscar Product/Promotion para obtener BusinessId
    console.log(`🔎 Buscando objeto con ID: ${productId}`);
    let product = await Product.findById(productId);
    let isPromotion = false;

    if (product) {
      console.log("✅ Encontrado como Producto:", product.name);
      businessId = product.business;
    } else {
      console.log("⚠️ No encontrado como Producto. Buscando en Promociones...");
      product = await Promotion.findById(productId);
      if (product) {
        console.log("✅ Encontrado como Promoción:", product.name);
        isPromotion = true;
        businessId = product.business;
      } else {
        console.error("❌ Objeto no encontrado en ninguna colección");
        // Intentaremos buscar cualquier business para probar la funcion de comision
        const anyUser = await mongoose.model("User").findById(employeeId);
        if (anyUser) {
          console.log("Employee User found:", anyUser.name);
          // Try to find membership
          const mem = await mongoose
            .model("Membership")
            .findOne({ user: employeeId });
          if (mem) businessId = mem.business;
        }
      }
    }

    console.log("🏢 Business ID:", businessId);

    // 2. Probar getEmployeeCommissionInfo
    console.log("🧪 Probando getEmployeeCommissionInfo...");
    try {
      const commissionInfo = await getEmployeeCommissionInfo(
        employeeId,
        businessId,
      );
      console.log("✅ getEmployeeCommissionInfo Resultado:", commissionInfo);
    } catch (e) {
      console.error("❌ CRASH en getEmployeeCommissionInfo:", e);
      console.error(e.stack);
    }

    // 3. Probar lógica de getEmployeePrice
    console.log("🧪 Probando lógica getEmployeePrice...");

    if (isPromotion && product) {
      // Lógica del controlador...
      const mockProduct = {
        _id: product._id,
        name: product.name,
        purchasePrice: product.originalPrice || 0,
        employeePrice: product.employeePrice,
        clientPrice: product.promotionPrice,
      };

      console.log("Mock Product created:", mockProduct);

      let profitPercentage = await getEmployeeProfitPercentage(
        employeeId,
        businessId,
      );
      console.log("Profit Percentage Base:", profitPercentage);

      if (mockProduct.employeePrice > 0 && mockProduct.clientPrice > 0) {
        const calculatedPct =
          100 * (1 - mockProduct.employeePrice / mockProduct.clientPrice);
        console.log("Calculated Profit Percentage (Fixed):", calculatedPct);
        profitPercentage = Number(calculatedPct.toFixed(2));
        console.log("Final Profit Percentage:", profitPercentage);
      } else {
        console.log("⚠️ Precios 0 o faltantes, saltando cálculo fijo.");
      }
    }
  } catch (error) {
    console.error("❌ Error Fatal:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Desconectado");
  }
}

run();
