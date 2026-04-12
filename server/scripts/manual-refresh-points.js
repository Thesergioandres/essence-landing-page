import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import EmployeeStats from "../src/infrastructure/database/models/EmployeeStats.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import { productSchema } from "../src/infrastructure/database/models/Product.js";
import { GamificationRepository } from "../src/infrastructure/database/repositories/GamificationRepository.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI_DEV_LOCAL ||
  "mongodb://localhost:27017/essence_local";

async function main() {
  console.log("🚀 Conectando a MongoDB...", MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log("✅ Conectado.");

  // Force registration if missing?
  if (!mongoose.modelNames().includes("Product")) {
    console.log(
      "📦 Registrando modelo Product manualmente con esquema importado...",
    );
    mongoose.model("Product", productSchema);
  }

  console.log("📦 Modelos registrados en Mongoose:", mongoose.modelNames());

  const repo = new GamificationRepository();

  const allSales = await Sale.find({}).select(
    "paymentStatus employee salePrice quantity totalProfit business",
  );
  console.log(`📊 Total ventas en la base de datos: ${allSales.length}`);

  const statusCounts = {};
  let withEmployeeCount = 0;

  allSales.forEach((s) => {
    statusCounts[s.paymentStatus] = (statusCounts[s.paymentStatus] || 0) + 1;
    if (s.employee) withEmployeeCount++;
  });

  console.log("📈 Desglose por estado:", statusCounts);
  console.log(`👤 Ventas con empleado asignado: ${withEmployeeCount}`);

  const confirmedEmployeeSales = allSales.filter(
    (s) => s.paymentStatus === "confirmado" && s.employee,
  );
  console.log(
    `✅ Ventas CONFIRMADAS y con EMPLEADO (son las que dan puntos): ${confirmedEmployeeSales.length}`,
  );

  fs.writeFileSync(
    "debug_sales.json",
    JSON.stringify(
      {
        registeredModels: mongoose.modelNames(),
        totalSales: allSales.length,
        statusCounts,
        withEmployeeCount,
        confirmedEmployeeSalesCount: confirmedEmployeeSales.length,
        sampleEmployeeSale: allSales.find((s) => s.employee),
      },
      null,
      2,
    ),
  );
  console.log("📄 Datos de debug guardados en debug_sales.json");

  if (confirmedEmployeeSales.length === 0) {
    console.warn(
      "⚠️ No hay ventas confirmadas con empleado asignado. Por eso tienen 0 puntos.",
    );

    const distSales = allSales.filter((s) => s.employee);
    if (distSales.length > 0) {
      console.log("🔍 Ejemplo de venta de empleado:", distSales[0]);
    }
    process.exit(0);
  }

  const salesWithEmployee = confirmedEmployeeSales;
  const businesses = [
    ...new Set(
      salesWithEmployee.map((s) => s.business?.toString()).filter(Boolean),
    ),
  ];
  console.log(`🏢 Negocios encontrados: ${businesses.length}`);

  const config = await mongoose.model("GamificationConfig").findOne().lean();
  console.log(
    "⚙️ Configuración de Gamificación:",
    config
      ? JSON.stringify(config.generalRules)
      : "No encontrada (usando defaults)",
  );

  for (const businessId of businesses) {
    console.log(`\n🔄 Procesando negocio ${businessId}...`);
    try {
      const result = await repo.recalculatePoints(businessId);
      console.log(`   ✅ Resultado: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`   ❌ Error procesando negocio ${businessId}:`, error);
      fs.writeFileSync(
        "error_log.json",
        JSON.stringify(
          {
            businessId,
            message: error.message,
            stack: error.stack,
          },
          null,
          2,
        ),
      );
    }
  }

  console.log("\n🏁 Proceso finalizado. Verificando stats...");
  const stats = await EmployeeStats.find().populate(
    "employee",
    "name email",
  );
  stats.forEach((s) => {
    console.log(
      `   👤 ${s.employee?.name || "Desconocido"} (${s.employee?.email}): ${s.totalPoints} puntos - Nivel: ${s.currentLevel}`,
    );
  });

  process.exit(0);
}

main().catch(console.error);
