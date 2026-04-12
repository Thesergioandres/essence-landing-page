import dotenv from "dotenv";
import mongoose from "mongoose";

// Cargar el .env correcto segÃºn el entorno
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

const resolveDbName = (mongoUri) => {
  const explicitDbName =
    process.env.MONGO_DB_NAME || process.env.MONGODB_DB_NAME;

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

// Loggers de estado de conexiÃ³n (se ejecutan una sola vez por proceso)
mongoose.connection.on("connected", () => {
  console.warn("[Essence Debug]", "âœ… Evento connected: MongoDB activo");
});

mongoose.connection.on("disconnected", () => {
  console.warn("âš ï¸ Evento disconnected: MongoDB desconectado");
});

mongoose.connection.on("error", (err) => {
  console.error("âŒ Evento error en MongoDB:", err?.message || err);
});

const connectDB = async () => {
  try {
    // En desarrollo, preferir la BD local; en producciÃ³n usar MONGODB_URI
    let mongoUri;

    if (process.env.NODE_ENV === "development") {
      // Prioridad: MONGO_URI_DEV_LOCAL > MONGODB_URI > MONGO_URI
      mongoUri =
        process.env.MONGO_URI_DEV_LOCAL ||
        process.env.MONGODB_URI ||
        process.env.MONGO_URI;

      if (process.env.MONGO_URI_DEV_LOCAL) {
        console.warn("[Essence Debug]", "ðŸ“ Usando base de datos LOCAL (desarrollo)");
      }
    } else if (process.env.NODE_ENV === "test") {
      // En test: priorizar URIs de test para aislamiento
      mongoUri =
        process.env.MONGODB_URI_TEST ||
        process.env.MONGO_URI_TEST ||
        process.env.MONGODB_URI ||
        process.env.MONGO_URI;
    } else {
      // En producciÃ³n: usar la URI principal
      mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    }

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI no estÃ¡ definida en las variables de entorno",
      );
    }

    let dbName = resolveDbName(mongoUri);

    if (
      process.env.NODE_ENV === "production" &&
      (mongoUri.includes("_test") || dbName.includes("_test"))
    ) {
      throw new Error(
        "âŒ PELIGRO: Intentando usar base de datos de test en producciÃ³n",
      );
    }

    // SEGURIDAD: Verificar que en test no se use la BD de producciÃ³n
    if (process.env.NODE_ENV === "test" && !dbName.includes("_test")) {
      console.warn(
        "âš ï¸ URI de test sin sufijo _test detectada. Forzando dbName=essence_test para aislamiento.",
      );
      dbName = "essence_test";
    }

    const autoIndex = resolveAutoIndex();

    // Opciones explÃ­citas para diagnosticar timeouts y limitar pool
    const mongoOptions = {
      dbName,
      autoIndex,
      serverSelectionTimeoutMS: 10000, // falla rÃ¡pido si no se conecta
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    const conn = await mongoose.connect(mongoUri, mongoOptions);
    console.warn("[Essence Debug]", `âœ… MongoDB conectado: ${conn.connection.host}`);
    console.warn("[Essence Debug]", `ðŸ—„ï¸ Base de datos activa: ${conn.connection.name}`);
    console.warn("[Essence Debug]", `ðŸ§± autoIndex: ${autoIndex ? "habilitado" : "deshabilitado"}`);

    if (process.env.NODE_ENV === "test") {
      console.warn("[Essence Debug]", `ðŸ§ª Modo TEST: usando base de datos ${conn.connection.name}`);
    }
  } catch (error) {
    console.error("âŒ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;

