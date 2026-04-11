import dotenv from "dotenv";
import mongoose from "mongoose";
import AuditLog from "../src/infrastructure/database/models/AuditLog.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const targetBusinessId = process.argv[2] || process.env.TARGET_BUSINESS_ID;
const targetAuditId = process.argv[3]; // opcional: solo un log

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

if (!targetBusinessId) {
  console.error(
    "❌ Falta el BUSINESS_ID. Usa: node scripts/fixMissingAuditBusiness.js <BUSINESS_ID> [AUDIT_ID]"
  );
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  const businessObjectId = new mongoose.Types.ObjectId(targetBusinessId);
  const baseFilter = targetAuditId
    ? { _id: new mongoose.Types.ObjectId(targetAuditId) }
    : { $or: [{ business: { $exists: false } }, { business: null }] };

  const res = await AuditLog.updateMany(baseFilter, {
    $set: { business: businessObjectId },
  });

  console.log(
    `➡️  AuditLogs actualizados: matched=${res.matchedCount || 0}, modified=${
      res.modifiedCount || 0
    }`
  );

  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

run().catch((err) => {
  console.error("❌ Error en la corrección:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
