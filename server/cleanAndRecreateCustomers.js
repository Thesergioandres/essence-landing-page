import mongoose from "mongoose";

async function cleanAndRecreate() {
  try {
    await mongoose.connect("mongodb://localhost:27017/essence");
    console.log("✅ Conectado a MongoDB\n");

    const db = mongoose.connection.db;

    // Verificar si existe la colección
    const collections = await db
      .listCollections({ name: "customers" })
      .toArray();

    if (collections.length > 0) {
      console.log("🗑️  Eliminando colección 'customers' existente...");
      await db.collection("customers").drop();
      console.log("✅ Colección eliminada\n");
    } else {
      console.log("ℹ️  La colección 'customers' no existe\n");
    }

    // Crear la colección con los índices correctos
    console.log("✨ Creando colección 'customers' con índices correctos...\n");

    await db.createCollection("customers");
    console.log("✅ Colección creada");

    const collection = db.collection("customers");

    // Crear índice business (simple)
    await collection.createIndex({ business: 1 });
    console.log("✅ Índice creado: business_1");

    // Crear índice business + email (parcial, solo cuando email existe y no es null)
    await collection.createIndex(
      { business: 1, email: 1 },
      {
        unique: true,
        name: "business_1_email_1_partial",
        partialFilterExpression: {
          email: { $type: "string" },
        },
      }
    );
    console.log("✅ Índice creado: business_1_email_1_partial");

    // Crear índice business + phone (parcial, solo cuando phone existe y no es null)
    await collection.createIndex(
      { business: 1, phone: 1 },
      {
        unique: true,
        name: "business_1_phone_1_partial",
        partialFilterExpression: {
          phone: { $type: "string" },
        },
      }
    );
    console.log("✅ Índice creado: business_1_phone_1_partial");

    // Crear índice business + segment
    await collection.createIndex({ business: 1, segment: 1 });
    console.log("✅ Índice creado: business_1_segment_1");

    // Verificar índices creados
    console.log("\n📋 Índices finales:");
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${index.name}`);
      if (index.partialFilterExpression) {
        console.log(
          `    Filtro parcial: ${JSON.stringify(index.partialFilterExpression)}`
        );
      }
    });

    await mongoose.connection.close();
    console.log("\n✅ Proceso completado. Ahora reinicia el servidor.\n");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanAndRecreate();
