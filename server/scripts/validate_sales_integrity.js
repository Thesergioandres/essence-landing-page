import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { SaleRepository } from "../src/infrastructure/database/repositories/SaleRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const businessId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!mongoUri) {
  console.error("❌ MONGODB_URI no esta configurado");
  process.exit(1);
}

if (!businessId) {
  console.error(
    "❌ Falta BUSINESS_ID. Uso: node scripts/validate_sales_integrity.js <BUSINESS_ID> [--dry-run]",
  );
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Conectado a MongoDB");

    const saleRepository = new SaleRepository();
    const result = await saleRepository.validateIntegrity(businessId, {
      dryRun,
    });

    console.log("\n🧪 Resultado validateIntegrity:");
    console.log(`- invalidStatusCount: ${result.invalidStatusCount}`);
    console.log(`- statusUpdated: ${result.statusUpdated}`);
    console.log(`- orphanCandidates: ${result.orphanCandidates}`);
    console.log(`- orphanDeleted: ${result.orphanDeleted}`);

    await mongoose.connection.close();
    console.log("✅ Conexion cerrada");
  } catch (error) {
    console.error("❌ Error en validateIntegrity:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

run();
