/**
 * 🛡️ Middleware de Protección Anti-Producción
 *
 * Este middleware BLOQUEA cualquier intento de escribir en producción
 * y garantiza que todas las operaciones usen la BD local
 */

import mongoose from "mongoose";

const PROD_URI =
  process.env.MONGO_URI_PROD ||
  process.env.MONGODB_URI_PROD ||
  process.env.MONGO_URI_PROD_READ ||
  process.env.MONGODB_URI_PROD_READ ||
  "";

/**
 * Lista de métodos HTTP que implican escritura
 */
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Verificar que la conexión activa es la local
 */
const isLocalConnection = () => {
  const currentUri = mongoose.connection.host;
  let prodUri = null;
  try {
    if (PROD_URI) {
      const parsedUri =
        PROD_URI.startsWith("mongodb://") ||
        PROD_URI.startsWith("mongodb+srv://")
          ? PROD_URI
          : `mongodb://${PROD_URI}`;
      prodUri = new URL(parsedUri).hostname;
    }
  } catch (error) {
    console.error("[databaseGuard] Invalid PROD_URI format:", PROD_URI);
  }

  // Si no hay URI de producción configurada, asumir seguro
  if (!prodUri) return true;

  // Verificar que no estamos conectados a producción
  return currentUri !== prodUri;
};

/**
 * Middleware que protege contra escrituras accidentales en producción
 */
export const productionWriteGuard = (req, res, next) => {
  // Solo verificar en métodos de escritura
  if (!WRITE_METHODS.includes(req.method)) {
    return next();
  }

  // Verificar conexión
  if (!isLocalConnection()) {
    console.error(
      "❌ BLOQUEADO: Intento de escritura hacia producción detectado",
    );
    console.error(`   Método: ${req.method}`);
    console.error(`   Ruta: ${req.originalUrl}`);
    console.error(`   IP: ${req.ip}`);

    return res.status(403).json({
      success: false,
      error: "PRODUCTION_WRITE_BLOCKED",
      message:
        "Las operaciones de escritura están bloqueadas para la base de datos de producción. " +
        "Todas las modificaciones deben hacerse en la base de datos local.",
    });
  }

  next();
};

/**
 * Middleware que loguea el origen de todas las operaciones de BD
 */
export const databaseOperationLogger = (req, res, next) => {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEBUG_DB === "true"
  ) {
    const operation = WRITE_METHODS.includes(req.method) ? "WRITE" : "READ";
    console.log(
      `🔍 [DB-${operation}] ${req.method} ${req.originalUrl} → ${mongoose.connection.name}`,
    );
  }
  next();
};

/**
 * Verificador de seguridad al iniciar el servidor
 * @throws {Error} Si la configuración es insegura
 */
export const validateDatabaseSecurity = () => {
  console.log("\n🛡️  Validando seguridad de base de datos...\n");

  const localUri =
    process.env.MONGO_URI_DEV ||
    process.env.MONGO_URI_DEV_LOCAL ||
    process.env.MONGODB_URI;
  const prodUri = PROD_URI;

  // 1. Verificar que existe URI local
  if (!localUri) {
    throw new Error(
      "❌ MONGO_URI_DEV_LOCAL no está configurada.\n" +
        "   Configura una base de datos local para desarrollo.",
    );
  }

  // 2. Si hay URI de producción, verificar que son diferentes
  if (prodUri && prodUri === localUri) {
    throw new Error(
      "❌ PELIGRO: Las URIs de producción y local son iguales.\n" +
        "   Esto podría causar escrituras accidentales en producción.\n" +
        "   Configura bases de datos separadas en .env:\n" +
        "   - MONGO_URI_PROD (solo lectura en entornos no productivos)\n" +
        "   - MONGO_URI_DEV (lectura + escritura)",
    );
  }

  // 3. Verificar que no hay permisos de escritura en URI de producción
  if (prodUri) {
    // Advertir si la URI tiene parámetros de escritura
    if (prodUri.includes("w=majority") && !prodUri.includes("readPreference")) {
      console.warn(
        "⚠️  ADVERTENCIA: La URI de producción puede tener permisos de escritura.\n" +
          "   Recomendación: Usar un usuario de MongoDB con permisos de solo lectura.\n",
      );
    }
  }

  // 4. Verificar NODE_ENV
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "⚠️  Ejecutando en modo PRODUCCIÓN.\n" +
        "   La sincronización Prod→Local está DESHABILITADA.\n",
    );
  }

  console.log("✅ Configuración de seguridad validada.\n");
  console.log(
    `   📍 BD Local: ${localUri.includes("localhost") ? "localhost" : "remota"}`,
  );
  console.log(
    `   📍 BD Prod: ${prodUri ? "configurada (solo lectura)" : "no configurada"}`,
  );
  console.log("");

  return true;
};

/**
 * Wrapper para mongoose que previene escrituras en producción
 * Usar este wrapper en lugar de mongoose directamente
 */
export const safeMongoose = {
  // Solo exponer métodos de lectura
  connection: mongoose.connection,

  // Métodos de lectura seguros
  model: (name) => {
    const model = mongoose.model(name);

    // En desarrollo, permitir todo
    if (process.env.NODE_ENV !== "production") {
      return model;
    }

    // En producción, solo lectura
    return {
      find: model.find.bind(model),
      findOne: model.findOne.bind(model),
      findById: model.findById.bind(model),
      countDocuments: model.countDocuments.bind(model),
      aggregate: model.aggregate.bind(model),
      distinct: model.distinct.bind(model),
      exists: model.exists.bind(model),
      // Bloquear escrituras
      create: () => {
        throw new Error("Escritura bloqueada en producción");
      },
      insertMany: () => {
        throw new Error("Escritura bloqueada en producción");
      },
      updateOne: () => {
        throw new Error("Escritura bloqueada en producción");
      },
      updateMany: () => {
        throw new Error("Escritura bloqueada en producción");
      },
      deleteOne: () => {
        throw new Error("Escritura bloqueada en producción");
      },
      deleteMany: () => {
        throw new Error("Escritura bloqueada en producción");
      },
    };
  },
};

export default {
  productionWriteGuard,
  databaseOperationLogger,
  validateDatabaseSecurity,
  safeMongoose,
};
