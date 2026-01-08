import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function checkIndexes() {
  try {
    const MONGO_URI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/essence";
    console.log(
      "🔗 Conectando a:",
      MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
    );

    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB\n");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const customersExists = collections.some((c) => c.name === "customers");

    if (!customersExists) {
      console.log("⚠️  La colección 'customers' no existe aún");
      await mongoose.connection.close();
      return;
    }

    const indexes = await db.collection("customers").indexes();
    console.log("📋 Índices actuales en 'customers':");
    indexes.forEach((index) => {
      console.log(
        `  - ${index.name}:`,
        JSON.stringify(index.key),
        index.unique ? "(unique)" : "",
        index.sparse ? "(sparse)" : "",
        index.partialFilterExpression
          ? `(partial: ${JSON.stringify(index.partialFilterExpression)})`
          : ""
      );
    });

    // Contar documentos
    const count = await db.collection("customers").countDocuments();
    console.log(`\n📊 Total de clientes: ${count}`);

    // Mostrar clientes
    if (count > 0) {
      const customers = await db
        .collection("customers")
        .find()
        .limit(10)
        .toArray();
      console.log("\n👥 Clientes:");
      customers.forEach((c) => {
        console.log(
          `  - ${c.name} | email: ${c.email || "(sin email)"} | phone: ${
            c.phone || "(sin teléfono)"
          }`
        );
      });
    }

    await mongoose.connection.close();
    console.log("\n✅ Desconectado");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkIndexes();
