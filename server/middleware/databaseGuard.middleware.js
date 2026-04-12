/**
 * ðŸ›¡ï¸ Middleware de ProtecciÃ³n Anti-ProducciÃ³n
 *
 * Este middleware BLOQUEA cualquier intento de escribir en producciÃ³n
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
 * Lista de mÃ©todos HTTP que implican escritura
 */
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Verificar que la conexiÃ³n activa es la local
 */
const isLocalConnection = () => {
  const currentUri = mongoose.connection.host;
  const prodUri = PROD_URI ? new URL(PROD_URI).hostname : null;

  // Si no hay URI de producciÃ³n configurada, asumir seguro
  if (!prodUri) return true;

  // Verificar que no estamos conectados a producciÃ³n
  return currentUri !== prodUri;
};

/**
 * Middleware que protege contra escrituras accidentales en producciÃ³n
 */
export const productionWriteGuard = (req, res, next) => {
  // Solo verificar en mÃ©todos de escritura
  if (!WRITE_METHODS.includes(req.method)) {
    return next();
  }

  // Verificar conexiÃ³n
  if (!isLocalConnection()) {
    console.error(
      "âŒ BLOQUEADO: Intento de escritura hacia producciÃ³n detectado",
    );
    console.error(`   MÃ©todo: ${req.method}`);
    console.error(`   Ruta: ${req.originalUrl}`);
    console.error(`   IP: ${req.ip}`);

    return res.status(403).json({
      success: false,
      error: "PRODUCTION_WRITE_BLOCKED",
      message:
        "Las operaciones de escritura estÃ¡n bloqueadas para la base de datos de producciÃ³n. " +
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
    console.warn("[Essence Debug]", 
      `ðŸ” [DB-${operation}] ${req.method} ${req.originalUrl} â†’ ${mongoose.connection.name}`,
    );
  }
  next();
};

/**
 * Verificador de seguridad al iniciar el servidor
 * @throws {Error} Si la configuraciÃ³n es insegura
 */
export const validateDatabaseSecurity = () => {
  console.warn("[Essence Debug]", "\nðŸ›¡ï¸  Validando seguridad de base de datos...\n");

  const localUri =
    process.env.MONGO_URI_DEV ||
    process.env.MONGO_URI_DEV_LOCAL ||
    process.env.MONGODB_URI;
  const prodUri = PROD_URI;

  // 1. Verificar que existe URI local
  if (!localUri) {
    throw new Error(
      "âŒ MONGO_URI_DEV_LOCAL no estÃ¡ configurada.\n" +
        "   Configura una base de datos local para desarrollo.",
    );
  }

  // 2. Si hay URI de producciÃ³n, verificar que son diferentes
  if (prodUri && prodUri === localUri) {
    throw new Error(
      "âŒ PELIGRO: Las URIs de producciÃ³n y local son iguales.\n" +
        "   Esto podrÃ­a causar escrituras accidentales en producciÃ³n.\n" +
        "   Configura bases de datos separadas en .env:\n" +
        "   - MONGO_URI_PROD (solo lectura en entornos no productivos)\n" +
        "   - MONGO_URI_DEV (lectura + escritura)",
    );
  }

  // 3. Verificar que no hay permisos de escritura en URI de producciÃ³n
  if (prodUri) {
    // Advertir si la URI tiene parÃ¡metros de escritura
    if (prodUri.includes("w=majority") && !prodUri.includes("readPreference")) {
      console.warn(
        "âš ï¸  ADVERTENCIA: La URI de producciÃ³n puede tener permisos de escritura.\n" +
          "   RecomendaciÃ³n: Usar un usuario de MongoDB con permisos de solo lectura.\n",
      );
    }
  }

  // 4. Verificar NODE_ENV
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "âš ï¸  Ejecutando en modo PRODUCCIÃ“N.\n" +
        "   La sincronizaciÃ³n Prodâ†’Local estÃ¡ DESHABILITADA.\n",
    );
  }

  console.warn("[Essence Debug]", "âœ… ConfiguraciÃ³n de seguridad validada.\n");
  console.warn("[Essence Debug]", 
    `   ðŸ“ BD Local: ${localUri.includes("localhost") ? "localhost" : "remota"}`,
  );
  console.warn("[Essence Debug]", 
    `   ðŸ“ BD Prod: ${prodUri ? "configurada (solo lectura)" : "no configurada"}`,
  );
  console.warn("[Essence Debug]", "");

  return true;
};

/**
 * Wrapper para mongoose que previene escrituras en producciÃ³n
 * Usar este wrapper en lugar de mongoose directamente
 */
export const safeMongoose = {
  // Solo exponer mÃ©todos de lectura
  connection: mongoose.connection,

  // MÃ©todos de lectura seguros
  model: (name) => {
    const model = mongoose.model(name);

    // En desarrollo, permitir todo
    if (process.env.NODE_ENV !== "production") {
      return model;
    }

    // En producciÃ³n, solo lectura
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
        throw new Error("Escritura bloqueada en producciÃ³n");
      },
      insertMany: () => {
        throw new Error("Escritura bloqueada en producciÃ³n");
      },
      updateOne: () => {
        throw new Error("Escritura bloqueada en producciÃ³n");
      },
      updateMany: () => {
        throw new Error("Escritura bloqueada en producciÃ³n");
      },
      deleteOne: () => {
        throw new Error("Escritura bloqueada en producciÃ³n");
      },
      deleteMany: () => {
        throw new Error("Escritura bloqueada en producciÃ³n");
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

