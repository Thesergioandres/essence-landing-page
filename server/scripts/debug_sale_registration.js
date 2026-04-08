import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Models
import "../models/Branch.js";
import "../models/Business.js";
import "../models/Customer.js";
import "../models/DeliveryMethod.js";
import DistributorStock from "../models/DistributorStock.js";
import "../models/PaymentMethod.js";
import Product from "../src/infrastructure/database/models/Product.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

// Utils
import { getDistributorCommissionInfo } from "../utils/distributorPricing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const distributorId = "6976ea761b2368c4bc66ff0f";
    const productName = "Vape Test Azul"; // Or "Esencia Test Roja"

    console.log(`🔎 Buscando producto: ${productName}`);
    const product = await Product.findOne({
      name: { $regex: productName, $options: "i" },
    });

    if (!product) {
      console.error("❌ Producto no encontrado");
      return;
    }
    console.log(`✅ Producto encontrado: ${product.name} (${product._id})`);

    const businessId = product.business;
    const quantity = 1;
    const salePrice = 20000; // Mock price

    // Simulate Step-by-Step registerSale logic
    console.log("\n🧪 SIMULANDO REGISTER SALE:");

    // 1. Stock Check
    console.log("1. Verificando Stock...");
    const stock = await DistributorStock.findOne({
      distributor: distributorId,
      product: product._id,
    });
    console.log(`   Stock actual: ${stock ? stock.quantity : "N/A"}`);

    // 2. Commission Info
    console.log("2. Calculando Comisiones...");
    const commissionInfo = await getDistributorCommissionInfo(
      distributorId,
      businessId,
    );
    console.log("   Comission Info OK:", commissionInfo.profitPercentage);

    // 3. Create Sale Object (Mock)
    console.log("3. Creando Objeto Venta...");
    const saleData = {
      business: businessId,
      saleId: `DEBUG-${Date.now()}`,
      distributor: distributorId,
      product: product._id,
      productName: product.name,
      quantity,
      purchasePrice: product.purchasePrice || 0,
      salePrice,
      distributorPrice: product.distributorPrice || 0,
      paymentMethodCode: "cash",
      isCredit: false,
      saleDate: new Date(),
    };

    // 4. Save Sale
    console.log("4. Guardando Venta (DB)...");
    const sale = await Sale.create(saleData);
    console.log(`   ✅ Venta creada: ${sale._id}`);

    // 5. Update Stock
    console.log("5. Descontando Stock...");
    if (stock) {
      stock.quantity -= quantity;
      await stock.save();
      console.log("   ✅ Stock descontado");
    }

    // 6. Notifications (Mock)
    console.log("6. Simulando Notificaciones (NotificationService)...");
    // Is there a crash here?
    // We can't easily reproduce internal service errors without calling the service directly.
    // But we can check if data required for it is present.

    console.log("✅ SIMULACIÓN COMPLETADA SIN ERRORES FATALES.");

    // Cleanup
    console.log("\n🧹 Limpiando venta de prueba...");
    await Sale.findByIdAndDelete(sale._id);
    if (stock) {
      stock.quantity += quantity;
      await stock.save();
    }
  } catch (error) {
    console.error("❌ CRASH REPRODUCIDO:", error.message);
    if (error.errors) {
      console.error("🔍 DETALLES DE VALIDACIÓN:");
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
