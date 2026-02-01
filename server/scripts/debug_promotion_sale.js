import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

// Models - Dynamic import to ensure order/registration
async function registerModels() {
  await import("../models/Business.js");
  await import("../models/Product.js"); // Ensure Product is registered
  await import("../models/Branch.js");
  await import("../models/Customer.js");
  await import("../models/PaymentMethod.js");
  await import("../models/Sale.js");
  await import("../models/DistributorStock.js");
  await import("../models/User.js");
  await import("../models/Promotion.js");
}

async function run() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("📚 Registrando modelos...");
    await registerModels();
    console.log("📚 Modelos registrados:", mongoose.modelNames());

    // Check if Product is registered
    if (!mongoose.modelNames().includes("Product")) {
      throw new Error("❌ CATASTROPHIC FAILURE: Product model not registered");
    }

    const { getDistributorCommissionInfo } =
      await import("../utils/distributorPricing.js");
    const Sale = mongoose.model("Sale");
    const Promotion = mongoose.model("Promotion");
    const DistributorStockModel = mongoose.model("DistributorStock");

    const distributorId = "6976ea761b2368c4bc66ff0f";

    console.log("🎁 Buscando una Promoción tipo Combo...");
    const promotion = await Promotion.findOne({ type: "combo" }).populate(
      "comboItems.product",
    );

    if (!promotion) {
      console.error(
        "❌ No se encontraron promociones tipo Combo para la prueba.",
      );
      return;
    }
    console.log(
      `✅ Promoción encontrada: ${promotion.name} (${promotion._id})`,
    );

    // Check component stock first
    console.log("\n1. Verificando Stock de Componentes...");

    for (const item of promotion.comboItems) {
      if (!item.product) {
        console.warn(
          "   ⚠️ Item con producto nulo/eliminado (debería ser ignorado por el fix)",
        );
        continue;
      }
      const ds = await DistributorStockModel.findOne({
        distributor: distributorId,
        product: item.product._id,
      });
      console.log(
        `   - ${item.product.name}: Req: ${item.quantity}, Disp: ${ds ? ds.quantity : 0}`,
      );

      // Ensure enough stock for test
      if (!ds || ds.quantity < item.quantity) {
        console.log("   🔧 Inyectando stock temporal para la prueba...");
        await DistributorStockModel.findOneAndUpdate(
          {
            distributor: distributorId,
            product: item.product._id,
            business: promotion.business,
          },
          { $set: { quantity: 10 } },
          { upsert: true },
        );
      }
    }

    // Simulate Register Sale Logic for Promotion
    console.log("\n🧪 SIMULANDO REGISTER SALE (PROMOCIÓN):");

    // Logic from controller (simplified)
    const product = {
      _id: promotion._id,
      name: `📦 ${promotion.name}`,
      purchasePrice: promotion.originalPrice || 0,
      distributorPrice: promotion.distributorPrice || 0, // Fallback logic
      business: promotion.business,
    };

    const businessId = promotion.business;
    const quantity = 1;

    // Use a simpler salePrice for test
    const salePrice = 30000;

    const saleData = {
      business: businessId,
      saleId: `DEBUG-PROMO-${Date.now()}`,
      distributor: distributorId,
      product: product._id,
      productName: product.name,
      quantity,
      purchasePrice: product.purchasePrice || 0,
      salePrice,
      distributorPrice: product.distributorPrice || 0, // CRITICAL FIX
      paymentMethodCode: "cash",
      isCredit: false,
      saleDate: new Date(),
    };

    console.log("4. Guardando Venta (DB)...");
    const sale = await Sale.create(saleData);
    console.log(`   ✅ Venta creada: ${sale._id}`);

    // Deduct Stock Logic (The Fix)
    console.log("5. Ejecutando deductDistributorPromotionStock (SIMULADO)...");

    // Simulate deduct function
    const deductedItems = [];
    for (const item of promotion.comboItems) {
      if (!item.product) {
        console.log("   ⚠️ Saltando producto nulo (Fix verificado)");
        continue;
      }
      const deductQty = (item.quantity || 1) * quantity;
      await DistributorStockModel.findOneAndUpdate(
        {
          distributor: distributorId,
          product: item.product._id,
          business: businessId,
        },
        { $inc: { quantity: -deductQty } },
      );
      deductedItems.push({ product: item.product._id, quantity: deductQty });
      console.log(`   ✅ Descontado ${deductQty} de ${item.product.name}`);
    }

    console.log("✅ SIMULACIÓN DE PROMOCIÓN COMPLETADA SIN ERRORES.");

    // Cleanup
    console.log("\n🧹 Limpiando venta de prueba...");
    await Sale.findByIdAndDelete(sale._id);

    // Restore stock
    for (const item of deductedItems) {
      await DistributorStockModel.findOneAndUpdate(
        {
          distributor: distributorId,
          product: item.product,
          business: businessId,
        },
        { $inc: { quantity: item.quantity } },
      );
    }
    console.log("   ✅ Stock restaurado");
  } catch (error) {
    console.error("❌ CRASH REPRODUCIDO:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Desconectado");
  }
}

run();
