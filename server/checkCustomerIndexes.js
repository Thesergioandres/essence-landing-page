import mongoose from "mongoose";

async function checkIndexes() {
  try {
    await mongoose.connect("mongodb://localhost:27017/essence");
    console.log("✅ Conectado a MongoDB");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const customersExists = collections.some((c) => c.name === "customers");

    if (!customersExists) {
      console.log("⚠️  La colección 'customers' no existe aún");
      await mongoose.connection.close();
      return;
    }

    const indexes = await db.collection("customers").indexes();
    console.log("\n📋 Índices actuales en 'customers':");
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

    // Mostrar algunos documentos
    if (count > 0) {
      const customers = await db
        .collection("customers")
        .find()
        .limit(5)
        .toArray();
      console.log("\n👥 Primeros clientes:");
      customers.forEach((c) => {
        console.log(
          `  - ${c.name} | email: ${c.email || "null"} | phone: ${
            c.phone || "null"
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
