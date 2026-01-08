import dotenv from "dotenv";
import mongoose from "mongoose";

// Cargar el .env correcto según el entorno
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

// Opciones explícitas para diagnosticar timeouts y limitar pool
const mongoOptions = {
  serverSelectionTimeoutMS: 10000, // falla rápido si no se conecta
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
};

// Loggers de estado de conexión (se ejecutan una sola vez por proceso)
mongoose.connection.on("connected", () => {
  console.log("✅ Evento connected: MongoDB activo");
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ Evento disconnected: MongoDB desconectado");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Evento error en MongoDB:", err?.message || err);
});

const connectDB = async () => {
  try {
    // Soportar tanto MONGODB_URI como MONGO_URI (legacy)
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI no está definida en las variables de entorno"
      );
    }

    // SEGURIDAD: Verificar que en producción no se use la BD de test
    if (process.env.NODE_ENV === "production" && mongoUri.includes("_test")) {
      throw new Error(
        "❌ PELIGRO: Intentando usar base de datos de test en producción"
      );
    }

    // SEGURIDAD: Verificar que en test no se use la BD de producción
    if (process.env.NODE_ENV === "test" && !mongoUri.includes("_test")) {
      throw new Error(
        "❌ PELIGRO: Los tests deben usar una base de datos separada (essence_test)"
      );
    }

    const conn = await mongoose.connect(mongoUri, mongoOptions);
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);

    if (process.env.NODE_ENV === "test") {
      console.log(`🧪 Modo TEST: usando base de datos ${conn.connection.name}`);
    }
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;
