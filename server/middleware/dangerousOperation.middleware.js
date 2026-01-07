import { createBackup } from "../utils/backup.js";
import { logApiError, logApiInfo } from "../utils/logger.js";

/**
 * Middleware para operaciones peligrosas
 * Crea backup automático antes de operaciones destructivas
 */
export const protectDangerousOperation = (operationName) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const requestId = req.reqId;

    logApiInfo({
      message: `dangerous_operation_started`,
      module: "protection",
      requestId,
      userId,
      extra: { operation: operationName },
    });

    // Solo GOD puede ejecutar operaciones peligrosas sin restricciones
    if (req.user?.role !== "god") {
      logApiError({
        message: `dangerous_operation_blocked`,
        module: "protection",
        requestId,
        userId,
        extra: { operation: operationName, userRole: req.user?.role },
      });

      return res.status(403).json({
        message: "Operación peligrosa: solo usuarios GOD pueden ejecutarla",
        code: "DANGEROUS_OPERATION_RESTRICTED",
        requestId,
      });
    }

    // Intentar crear backup (solo en producción)
    if (process.env.NODE_ENV === "production") {
      try {
        console.log(`⚠️  Operación peligrosa detectada: ${operationName}`);
        console.log("📦 Creando backup automático de seguridad...");

        await createBackup();

        console.log("✅ Backup de seguridad creado");
      } catch (backupError) {
        console.error(
          "⚠️  No se pudo crear backup automático:",
          backupError.message
        );
        // Continuar pero registrar el error
      }
    }

    // Agregar flag al request
    req.dangerousOperation = {
      name: operationName,
      timestamp: new Date(),
      user: userId,
    };

    next();
  };
};

/**
 * Middleware para confirmar operaciones destructivas
 * Requiere header x-confirm-operation: true
 */
export const requireConfirmation = (req, res, next) => {
  const confirmation = req.headers["x-confirm-operation"];

  if (confirmation !== "true") {
    return res.status(400).json({
      message: "Operación destructiva requiere confirmación",
      code: "CONFIRMATION_REQUIRED",
      hint: "Envía el header x-confirm-operation: true para confirmar",
      requestId: req.reqId,
    });
  }

  next();
};
