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

// Cargar el .env correcto según el entorno
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

export const connectDB = async () => {
  try {
    const { prodUri, devUri, testUri } = resolveMongoUris();
    const nodeEnv = process.env.NODE_ENV || "development";
    let mongoUri = "";

    if (nodeEnv === "development") {
      mongoUri = devUri;

      if (process.env.MONGO_URI_DEV || process.env.MONGO_URI_DEV_LOCAL) {
        console.log("📍 Usando base de datos LOCAL (desarrollo)");
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
        "No se encontró URI de MongoDB para el entorno actual (MONGO_URI_PROD / MONGO_URI_DEV / MONGO_URI_TEST)",
      );
    }

    const nonProductionPointsToProd =
      nodeEnv !== "production" && isProductionUriTarget(mongoUri, process.env);

    if (nonProductionPointsToProd) {
      console.warn(
        "⚠️  Entorno no productivo conectado a URI de producción: se forzará modo READ-ONLY estricto.",
      );
    }

    let dbName = resolveDbName(mongoUri);

    // SEGURIDAD: Verificar que en producción no se use la BD de test
    if (nodeEnv === "production" && (mongoUri.includes("_test") || dbName.includes("_test"))) {
      throw new Error(
        "❌ PELIGRO: Intentando usar base de datos de test en producción",
      );
    }

    // SEGURIDAD: Verificar que en test no se use la BD de producción
    if (nodeEnv === "test" && !dbName.includes("_test")) {
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

    if (nonProductionPointsToProd) {
      enforceReadOnlyForProtectedProductionUri(conn.connection, mongoUri, {
        nodeEnv,
      });
      console.warn(
        "🛡️ Muro de Producción activo: escritura bloqueada en esta conexión.",
      );
    }

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`🗄️ Base de datos activa: ${conn.connection.name}`);
    console.log(`🧱 autoIndex: ${autoIndex ? "habilitado" : "deshabilitado"}`);

    if (nodeEnv === "test") {
      console.log(`🧪 Modo TEST: usando base de datos ${conn.connection.name}`);
    }
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};
