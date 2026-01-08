import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const cleanDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    // PROTECCIÓN 1: Verificar que no sea producción
    if (process.env.NODE_ENV === "production") {
      console.error("❌ ERROR: Este script NO puede ejecutarse en producción");
      console.error(
        "   Para limpiar datos en producción, hazlo manualmente desde MongoDB Atlas"
      );
      process.exit(1);
    }

    // PROTECCIÓN 2: Verificar que sea base de datos de test
    if (!mongoUri.includes("_test") && !mongoUri.includes("localhost")) {
      console.error("❌ ERROR: Este script solo puede usarse con:");
      console.error("   - Base de datos de test (nombre debe incluir '_test')");
      console.error("   - Base de datos local (localhost)");
      console.error(
        `   Intentando conectar a: ${mongoUri.substring(0, 50)}...`
      );
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Conectado a MongoDB\n");

    const dbName = mongoose.connection.name;
    console.log(`📊 Base de datos: ${dbName}`);

    // PROTECCIÓN 3: Confirmación final
    if (!dbName.includes("_test")) {
      console.error(
        "❌ ERROR: La base de datos NO contiene '_test' en el nombre"
      );
      console.error("   Por seguridad, este script se detendrá");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log("═══════════════════════════════════════════════════");
    console.log("⚠️  LIMPIEZA COMPLETA DE BASE DE DATOS DE TEST");
    console.log("═══════════════════════════════════════════════════\n");

    // Obtener todas las colecciones
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    console.log(`🗑️  Eliminando ${collections.length} colecciones...\n`);

    let totalDeleted = 0;

    for (const collection of collections) {
      const collectionName = collection.name;
      try {
        const result = await mongoose.connection.db
          .collection(collectionName)
          .deleteMany({});

        if (result.deletedCount > 0) {
          console.log(
            `   ✅ ${collectionName}: ${result.deletedCount} documentos eliminados`
          );
          totalDeleted += result.deletedCount;
        } else {
          console.log(`   ⚪ ${collectionName}: ya estaba vacía`);
        }
      } catch (error) {
        console.log(`   ❌ ${collectionName}: Error - ${error.message}`);
      }
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`✅ LIMPIEZA COMPLETADA`);
    console.log(`   Total documentos eliminados: ${totalDeleted}`);
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 La base de datos ahora está completamente vacía.");
    console.log(
      "💡 Puedes empezar de cero registrando usuarios desde el frontend.\n"
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

cleanDatabase();
