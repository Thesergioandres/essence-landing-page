/**
 * Script para crear/verificar índices de MongoDB
 * Ejecutar: node scripts/createIndexes.js
 *
 * Este script verifica y crea índices optimizados para las colecciones
 * más consultadas del sistema.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const indexes = {
  users: [
    { key: { email: 1 }, unique: true },
    { key: { role: 1, status: 1 } },
    { key: { status: 1, subscriptionExpiresAt: 1 } },
    { key: { role: 1, active: 1 } },
    { key: { createdAt: -1 } },
  ],
  businesses: [
    { key: { name: 1 }, unique: true },
    { key: { createdBy: 1, status: 1 } },
    { key: { status: 1, createdAt: -1 } },
  ],
  sales: [
    { key: { business: 1 } },
    { key: { branch: 1 } },
    { key: { customer: 1 } },
    { key: { saleDate: -1 } },
    { key: { business: 1, saleDate: -1 } },
    { key: { employee: 1, saleDate: -1 } },
    { key: { business: 1, employee: 1, saleDate: -1 } },
    { key: { business: 1, branch: 1, saleDate: -1 } },
    { key: { business: 1, customer: 1, saleDate: -1 } },
    { key: { paymentStatus: 1, saleDate: -1 } },
    { key: { business: 1, paymentStatus: 1, saleDate: -1 } },
    { key: { business: 1, saleId: 1 }, unique: true },
  ],
  products: [
    { key: { business: 1 } },
    { key: { category: 1 } },
    { key: { business: 1, category: 1 } },
    { key: { business: 1, active: 1 } },
    { key: { business: 1, featured: 1 } },
    { key: { name: "text", description: "text" } },
  ],
  customers: [
    { key: { business: 1 } },
    { key: { business: 1, email: 1 }, unique: true, sparse: true },
    { key: { business: 1, phone: 1 }, unique: true, sparse: true },
    { key: { business: 1, segment: 1 } },
    { key: { business: 1, totalSpend: -1 } },
    { key: { business: 1, totalDebt: -1 } },
  ],
  credits: [
    { key: { business: 1, status: 1 } },
    { key: { customer: 1, status: 1 } },
    { key: { business: 1, customer: 1 } },
    { key: { dueDate: 1, status: 1 } },
    { key: { branch: 1, status: 1 } },
    { key: { business: 1, createdAt: -1 } },
  ],
  notifications: [
    { key: { business: 1, user: 1, read: 1, createdAt: -1 } },
    { key: { business: 1, targetRole: 1, read: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    { key: { type: 1, business: 1 } },
  ],
  memberships: [
    { key: { user: 1, business: 1 }, unique: true },
    { key: { business: 1, role: 1 } },
    { key: { user: 1, status: 1 } },
  ],
  auditlogs: [
    { key: { business: 1, createdAt: -1 } },
    { key: { user: 1, createdAt: -1 } },
    { key: { action: 1, business: 1 } },
  ],
};

async function createIndexes() {
  try {
    console.log("Conectando a MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Conectado. Creando índices...\n");

    const db = mongoose.connection.db;

    for (const [collectionName, collectionIndexes] of Object.entries(indexes)) {
      console.log(`📦 Colección: ${collectionName}`);

      try {
        const collection = db.collection(collectionName);
        const existingIndexes = await collection.indexes();
        const existingIndexNames = existingIndexes.map((idx) => idx.name);

        for (const indexSpec of collectionIndexes) {
          const indexName = Object.entries(indexSpec.key)
            .map(([k, v]) => `${k}_${v}`)
            .join("_");

          // Verificar si ya existe
          if (existingIndexNames.includes(indexName)) {
            console.log(`   ✓ ${indexName} (ya existe)`);
            continue;
          }

          try {
            const options = { name: indexName };
            if (indexSpec.unique) options.unique = true;
            if (indexSpec.sparse) options.sparse = true;
            if (indexSpec.expireAfterSeconds !== undefined) {
              options.expireAfterSeconds = indexSpec.expireAfterSeconds;
            }

            await collection.createIndex(indexSpec.key, options);
            console.log(`   ✅ ${indexName} (creado)`);
          } catch (err) {
            if (err.code === 85) {
              // Index already exists with different options
              console.log(`   ⚠️ ${indexName} (conflicto de opciones)`);
            } else {
              console.log(`   ❌ ${indexName}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Colección no existe o error: ${err.message}`);
      }

      console.log("");
    }

    console.log("✅ Proceso completado");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createIndexes();
