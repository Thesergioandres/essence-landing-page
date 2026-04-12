import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import {
  enforceReadOnlyForProtectedProductionUri,
  isProductionUriTarget,
} from "../../../security/mongooseWriteProtector.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "../../../");

const safeTrim = (value) =>
  typeof value === "string" ? value.trim().replace(/^"|"$/g, "") : "";

const resolveFirstMongoUri = (...candidates) => {
  for (const candidate of candidates) {
    const value = safeTrim(candidate);
    if (value) {
      return value;
    }
  }
  return "";
};

const resolveMongoUris = () => {
  const prodUri = resolveFirstMongoUri(
    process.env.MONGO_URI_PROD,
    process.env.MONGODB_URI_PROD,
    process.env.MONGO_URI_PROD_READ,
    process.env.MONGODB_URI_PROD_READ,
    process.env.MONGO_PUBLIC_URL,
    process.env.RAILWAY_MONGO_PUBLIC_URL,
  );

  const devUri = resolveFirstMongoUri(
    process.env.MONGO_URI_DEV,
    process.env.MONGO_URI_DEV_LOCAL,
    process.env.MONGODB_URI,
    process.env.MONGO_URI,
    "mongodb://127.0.0.1:27017/essence_local",
  );

  const testUri = resolveFirstMongoUri(
    process.env.MONGO_URI_TEST,
    process.env.MONGODB_URI_TEST,
    process.env.MONGODB_URI,
    process.env.MONGO_URI,
    "mongodb://127.0.0.1:27017/essence_test",
  );

  return { prodUri, devUri, testUri };
};

// Cargar el .env correcto segÃºn el entorno
// Ajustamos paths para que busque en la raiz del servidor
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: path.join(SERVER_ROOT, ".env.test") });
} else {
  dotenv.config({ path: path.join(SERVER_ROOT, ".env") });
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

export const connectDB = async () => {
  try {
    const { prodUri, devUri, testUri } = resolveMongoUris();
    const nodeEnv = process.env.NODE_ENV || "development";
    let mongoUri = "";

    if (nodeEnv === "development") {
      mongoUri = devUri;

      if (process.env.MONGO_URI_DEV || process.env.MONGO_URI_DEV_LOCAL) {
        console.warn("[Essence Debug]", "ðŸ“ Usando base de datos LOCAL (desarrollo)");
      }
    } else if (nodeEnv === "test") {
      mongoUri = testUri;
    } else {
      mongoUri = resolveFirstMongoUri(
        process.env.MONGODB_URI,
        process.env.MONGO_URI,
        prodUri,
      );
    }

    if (!mongoUri) {
      throw new Error(
        "No se encontrÃ³ URI de MongoDB para el entorno actual (MONGO_URI_PROD / MONGO_URI_DEV / MONGO_URI_TEST)",
      );
    }

    const nonProductionPointsToProd =
      nodeEnv !== "production" && isProductionUriTarget(mongoUri, process.env);

    if (nonProductionPointsToProd) {
      console.warn(
        "âš ï¸  Entorno no productivo conectado a URI de producciÃ³n: se forzarÃ¡ modo READ-ONLY estricto.",
      );
    }

    let dbName = resolveDbName(mongoUri);

    // SEGURIDAD: Verificar que en producciÃ³n no se use la BD de test
    if (
      nodeEnv === "production" &&
      (mongoUri.includes("_test") || dbName.includes("_test"))
    ) {
      throw new Error(
        "âŒ PELIGRO: Intentando usar base de datos de test en producciÃ³n",
      );
    }

    // SEGURIDAD: Verificar que en test no se use la BD de producciÃ³n
    if (nodeEnv === "test" && !dbName.includes("_test")) {
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

    if (nonProductionPointsToProd) {
      enforceReadOnlyForProtectedProductionUri(conn.connection, mongoUri, {
        nodeEnv,
      });
      console.warn(
        "ðŸ›¡ï¸ Muro de ProducciÃ³n activo: escritura bloqueada en esta conexiÃ³n.",
      );
    }

    console.warn("[Essence Debug]", `âœ… MongoDB conectado: ${conn.connection.host}`);
    console.warn("[Essence Debug]", `ðŸ—„ï¸ Base de datos activa: ${conn.connection.name}`);
    console.warn("[Essence Debug]", `ðŸ§± autoIndex: ${autoIndex ? "habilitado" : "deshabilitado"}`);

    if (nodeEnv === "test") {
      console.warn("[Essence Debug]", `ðŸ§ª Modo TEST: usando base de datos ${conn.connection.name}`);
    }
  } catch (error) {
    console.error("âŒ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

