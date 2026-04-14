import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/essence";

async function addIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const db = mongoose.connection.db;

    // Índices para productos
    await db.collection("products").createIndex({ category: 1 });
    await db.collection("products").createIndex({ featured: 1 });
    await db.collection("products").createIndex({ name: 1 });
    console.log("✅ Índices de productos creados");

    // Índices para ventas
    await db.collection("sales").createIndex({ employee: 1, saleDate: -1 });
    await db
      .collection("sales")
      .createIndex({ business: 1, employee: 1, saleDate: -1 });
    await db.collection("sales").createIndex({ paymentStatus: 1 });
    await db.collection("sales").createIndex({ saleDate: -1 });
    await db
      .collection("sales")
      .createIndex({ employee: 1, paymentStatus: 1, saleDate: -1 });
    console.log("✅ Índices de ventas creados");

    // Índices para usuarios
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ role: 1, active: 1 });
    console.log("✅ Índices de usuarios creados");

    // Índices para stock
    await db
      .collection("employeestocks")
      .createIndex({ employee: 1, product: 1 }, { unique: true });
    await db.collection("employeestocks").createIndex({ employee: 1 });
    console.log("✅ Índices de stock creados");

    // Índices para gamificación
    await db
      .collection("employeestats")
      .createIndex({ employee: 1 }, { unique: true });
    await db.collection("periodwinners").createIndex({ periodStart: -1 });
    console.log("✅ Índices de gamificación creados");

    console.log("\n🎉 Todos los índices creados exitosamente");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

addIndexes();
