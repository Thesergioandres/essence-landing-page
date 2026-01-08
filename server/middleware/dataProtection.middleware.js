/**
 * Middleware de protección de datos
 * Bloquea operaciones peligrosas en producción
 */

import { logApiError } from "../utils/logger.js";

/**
 * Bloquear operaciones deleteMany en producción
 */
export const blockDangerousOperations = () => {
  if (process.env.NODE_ENV === "production") {
    // Interceptar mongoose deleteMany
    const mongoose = require("mongoose");
    const originalDeleteMany = mongoose.Model.deleteMany;

    mongoose.Model.deleteMany = function (conditions, options, callback) {
      const collectionName = this.collection.name;

      // Permitir solo si hay condiciones específicas (no borrado masivo)
      if (!conditions || Object.keys(conditions).length === 0) {
        const error = new Error(
          `❌ BLOQUEADO: deleteMany({}) no permitido en producción para colección ${collectionName}`
        );

        logApiError({
          message: "dangerous_operation_blocked",
          module: "security",
          extra: {
            operation: "deleteMany",
            collection: collectionName,
            environment: process.env.NODE_ENV,
          },
        });

        throw error;
      }

      // Permitir si tiene condiciones específicas
      return originalDeleteMany.call(this, conditions, options, callback);
    };
  }
};

/**
 * Validar que no se esté usando base de datos incorrecta
 */
export const validateDatabaseEnvironment = (req, res, next) => {
  const dbName = req.app.locals.mongoose?.connection?.name;

  // Producción no debe usar _test
  if (
    process.env.NODE_ENV === "production" &&
    dbName &&
    dbName.includes("_test")
  ) {
    logApiError({
      message: "wrong_database_environment",
      module: "security",
      extra: { dbName, environment: process.env.NODE_ENV },
    });

    return res.status(500).json({
      message: "Configuración de base de datos incorrecta",
      error: "WRONG_DATABASE",
    });
  }

  // Test no debe usar producción
  if (process.env.NODE_ENV === "test" && dbName && !dbName.includes("_test")) {
    logApiError({
      message: "test_using_production_db",
      module: "security",
      extra: { dbName, environment: process.env.NODE_ENV },
    });

    return res.status(500).json({
      message: "Tests no pueden usar base de datos de producción",
      error: "PRODUCTION_DB_IN_TEST",
    });
  }

  next();
};
