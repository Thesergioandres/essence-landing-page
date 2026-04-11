/**
 * Tareas programadas para notificaciones automáticas
 * Ejecutar estas funciones con un cron job (ej: cada hora o diariamente)
 */
import Business from "../src/infrastructure/database/models/Business.js";
import NotificationService from "../services/notification.service.js";
import { logApiError, logApiInfo } from "../utils/logger.js";

/**
 * Verificar créditos vencidos para todos los negocios
 */
export const checkAllOverdueCredits = async () => {
  const requestId = `cron-overdue-${Date.now()}`;
  console.log("[WORKER JOB STARTED] checkAllOverdueCredits", {
    requestId,
    timestamp: new Date().toISOString(),
  });

  try {
    const businesses = await Business.find({ isActive: true }).select("_id");
    let totalOverdue = 0;

    for (const business of businesses) {
      const count = await NotificationService.checkOverdueCredits(
        business._id,
        requestId
      );
      totalOverdue += count;
    }

    console.log("[WORKER JOB FINISHED] checkAllOverdueCredits", {
      requestId,
      businessCount: businesses.length,
      totalOverdue,
      timestamp: new Date().toISOString(),
    });

    logApiInfo({
      message: "cron_overdue_credits_complete",
      module: "cron",
      requestId,
      extra: { businessCount: businesses.length, totalOverdue },
    });

    return totalOverdue;
  } catch (error) {
    console.error("[WORKER ERROR] checkAllOverdueCredits", {
      requestId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    logApiError({
      message: "Error en cron de créditos vencidos",
      module: "cron",
      requestId,
      stack: error.stack,
    });
    return 0;
  }
};

/**
 * Verificar stock bajo para todos los negocios
 */
export const checkAllLowStock = async (threshold = 10) => {
  const requestId = `cron-lowstock-${Date.now()}`;
  console.log("[WORKER JOB STARTED] checkAllLowStock", {
    requestId,
    threshold,
    timestamp: new Date().toISOString(),
  });

  try {
    const businesses = await Business.find({ isActive: true }).select("_id");
    let totalLowStock = 0;

    for (const business of businesses) {
      const count = await NotificationService.checkLowStock(
        business._id,
        threshold,
        requestId
      );
      totalLowStock += count;
    }

    console.log("[WORKER JOB FINISHED] checkAllLowStock", {
      requestId,
      businessCount: businesses.length,
      totalLowStock,
      timestamp: new Date().toISOString(),
    });

    logApiInfo({
      message: "cron_low_stock_complete",
      module: "cron",
      requestId,
      extra: { businessCount: businesses.length, totalLowStock },
    });

    return totalLowStock;
  } catch (error) {
    console.error("[WORKER ERROR] checkAllLowStock", {
      requestId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    logApiError({
      message: "Error en cron de stock bajo",
      module: "cron",
      requestId,
      stack: error.stack,
    });
    return 0;
  }
};

/**
 * Ejecutar todas las verificaciones de notificaciones
 */
export const runNotificationChecks = async () => {
  const requestId = `cron-notifications-${Date.now()}`;
  console.log("[WORKER JOB STARTED] runNotificationChecks", {
    requestId,
    timestamp: new Date().toISOString(),
  });

  const overdueCount = await checkAllOverdueCredits();
  const lowStockCount = await checkAllLowStock();

  console.log("[WORKER JOB FINISHED] runNotificationChecks", {
    requestId,
    overdueCount,
    lowStockCount,
    timestamp: new Date().toISOString(),
  });

  return { overdueCount, lowStockCount };
};

export default {
  checkAllOverdueCredits,
  checkAllLowStock,
  runNotificationChecks,
};
