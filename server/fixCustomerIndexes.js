import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/essence";

async function fixIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB");

    const db = mongoose.connection.db;

    // Verificar si la colección existe
    const collections = await db
      .listCollections({ name: "customers" })
      .toArray();

    if (collections.length === 0) {
      console.log("\n⚠️  La colección 'customers' no existe aún");
      console.log(
        "Se creará automáticamente cuando insertes el primer documento"
      );
      console.log("Los índices se aplicarán desde el modelo Customer.js");
      process.exit(0);
    }

    const collection = db.collection("customers");

    // Listar índices actuales
    console.log("\n📋 Índices actuales:");
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Eliminar índices problemáticos
    console.log("\n🗑️  Eliminando índices antiguos...");
    try {
      await collection.dropIndex("business_1_email_1");
      console.log("   ✅ Eliminado: business_1_email_1");
    } catch (e) {
      console.log("   ⚠️  No existe: business_1_email_1");
    }

    try {
      await collection.dropIndex("business_1_phone_1");
      console.log("   ✅ Eliminado: business_1_phone_1");
    } catch (e) {
      console.log("   ⚠️  No existe: business_1_phone_1");
    }

    // Crear nuevos índices parciales
    console.log("\n✨ Creando índices parciales...");

    await collection.createIndex(
      { business: 1, email: 1 },
      {
        unique: true,
        name: "business_1_email_1_partial",
        partialFilterExpression: {
          email: { $exists: true, $ne: null, $ne: "" },
        },
      }
    );
    console.log("   ✅ Creado: business_1_email_1_partial");

    await collection.createIndex(
      { business: 1, phone: 1 },
      {
        unique: true,
        name: "business_1_phone_1_partial",
        partialFilterExpression: {
          phone: { $exists: true, $ne: null, $ne: "" },
        },
      }
    );
    console.log("   ✅ Creado: business_1_phone_1_partial");

    // Verificar índices finales
    console.log("\n📋 Índices finales:");
    const finalIndexes = await collection.indexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log("\n✅ Índices recreados exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

fixIndexes();
