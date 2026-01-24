import dotenv from "dotenv";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  // 1. Eliminar todos los logs actuales
  console.log("🗑️  Eliminando logs existentes...");
  const deleteResult = await AuditLog.deleteMany({});
  console.log(`✅ Eliminados ${deleteResult.deletedCount} logs.`);

  // 2. Crear índice TTL de 15 días
  // 15 días * 24 horas * 60 min * 60 seg = 1296000 segundos
  console.log("⚡ Creando índice TTL (15 días)...");

  // Eliminar índice anterior si existe para evitar conflictos de opciones
  try {
    await AuditLog.collection.dropIndex("createdAt_1");
    console.log("   Índice createdAt_1 anterior eliminado (si existía).");
  } catch (e) {
    // Ignorar si no existe
  }

  await AuditLog.collection.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 1296000, background: true },
  );

  console.log("✅ Índice TTL creado exitosamente.");

  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
