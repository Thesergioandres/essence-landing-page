import dotenv from "dotenv";
import mongoose from "mongoose";

// Cargar variables de entorno
dotenv.config();

const testConnection = async () => {
  console.log("\n🔍 VERIFICACIÓN DE MONGODB\n");
  console.log("=".repeat(50));

  // 1. Verificar variable de entorno
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log("\n1️⃣ Variable de entorno:");
  if (mongoUri) {
    console.log("✅ MONGODB_URI está definida");
    // Ocultar password en el log
    const hiddenUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
    console.log(`   URI: ${hiddenUri}`);
  } else {
    console.log("❌ MONGODB_URI NO está definida");
    process.exit(1);
  }

  // 2. Intentar conexión
  console.log("\n2️⃣ Intentando conectar a MongoDB...");
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log("✅ Conexión exitosa!");
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Base de datos: ${conn.connection.name}`);
    console.log(
      `   Estado: ${
        conn.connection.readyState === 1 ? "Conectado" : "Desconectado"
      }`
    );

    // 3. Probar operación básica
    console.log("\n3️⃣ Probando operación de lectura...");
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`✅ Colecciones encontradas: ${collections.length}`);
    collections.forEach((col) => {
      console.log(`   - ${col.name}`);
    });

    // 4. Cerrar conexión
    console.log("\n4️⃣ Cerrando conexión...");
    await mongoose.connection.close();
    console.log("✅ Conexión cerrada correctamente");

    console.log("\n" + "=".repeat(50));
    console.log("✅ TODAS LAS VERIFICACIONES PASARON\n");
    process.exit(0);
  } catch (error) {
    console.log("\n❌ Error de conexión:");
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Código: ${error.code || "N/A"}`);

    console.log("\n💡 Posibles soluciones:");
    if (error.message.includes("authentication failed")) {
      console.log("   - Verifica usuario/contraseña en MongoDB Atlas");
      console.log("   - Ve a: Database Access y revisa las credenciales");
    } else if (error.message.includes("network")) {
      console.log("   - Verifica Network Access en MongoDB Atlas");
      console.log("   - Debe incluir 0.0.0.0/0 o tu IP actual");
    }

    console.log("\n" + "=".repeat(50));
    process.exit(1);
  }
};

testConnection();
