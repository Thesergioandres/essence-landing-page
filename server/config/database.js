import dotenv from "dotenv";
import mongoose from "mongoose";

// Cargar el .env correcto según el entorno
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

const resolveDbName = (mongoUri) => {
  const explicitDbName = process.env.MONGO_DB_NAME || process.env.MONGODB_DB_NAME;

  if (explicitDbName) return explicitDbName;

  try {
    const parsed = new URL(mongoUri);
    const dbNameFromPath = (parsed.pathname || "").replace(/^\/+/, "");
    if (dbNameFromPath) return dbNameFromPath;
  } catch {
    // no-op: fallback abajo
  }

  return process.env.NODE_ENV === "test" ? "essence_test" : "essence";
};

const resolveAutoIndex = () => {
  if (process.env.MONGO_AUTO_INDEX === "true") return true;
  if (process.env.MONGO_AUTO_INDEX === "false") return false;
  return true;
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
    // En desarrollo, preferir la BD local; en producción usar MONGODB_URI
    let mongoUri;

    if (process.env.NODE_ENV === "development") {
      // Prioridad: MONGO_URI_DEV_LOCAL > MONGODB_URI > MONGO_URI
      mongoUri =
        process.env.MONGO_URI_DEV_LOCAL ||
        process.env.MONGODB_URI ||
        process.env.MONGO_URI;

      if (process.env.MONGO_URI_DEV_LOCAL) {
        console.log("📍 Usando base de datos LOCAL (desarrollo)");
      }
    } else if (process.env.NODE_ENV === "test") {
      // En test: priorizar URIs de test para aislamiento
      mongoUri =
        process.env.MONGODB_URI_TEST ||
        process.env.MONGO_URI_TEST ||
        process.env.MONGODB_URI ||
        process.env.MONGO_URI;
    } else {
      // En producción: usar la URI principal
      mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    }

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI no está definida en las variables de entorno",
      );
    }

    let dbName = resolveDbName(mongoUri);

    if (
      process.env.NODE_ENV === "production" &&
      (mongoUri.includes("_test") || dbName.includes("_test"))
    ) {
      throw new Error(
        "❌ PELIGRO: Intentando usar base de datos de test en producción",
      );
    }

    // SEGURIDAD: Verificar que en test no se use la BD de producción
    if (process.env.NODE_ENV === "test" && !dbName.includes("_test")) {
      console.warn(
        "⚠️ URI de test sin sufijo _test detectada. Forzando dbName=essence_test para aislamiento.",
      );
      dbName = "essence_test";
    }

    const autoIndex = resolveAutoIndex();

    // Opciones explícitas para diagnosticar timeouts y limitar pool
    const mongoOptions = {
      dbName,
      autoIndex,
      serverSelectionTimeoutMS: 10000, // falla rápido si no se conecta
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    const conn = await mongoose.connect(mongoUri, mongoOptions);
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`🗄️ Base de datos activa: ${conn.connection.name}`);
    console.log(`🧱 autoIndex: ${autoIndex ? "habilitado" : "deshabilitado"}`);

    if (process.env.NODE_ENV === "test") {
      console.log(`🧪 Modo TEST: usando base de datos ${conn.connection.name}`);
    }
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;
