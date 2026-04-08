import User from "../src/infrastructure/database/models/User.js";

/**
 * Cron job para verificar y expirar suscripciones vencidas
 * Este worker revisa:
 * 1. Usuarios con subscriptionExpiresAt pasada y status = "active"
 * 2. Marca automáticamente como "expired"
 */

/**
 * Verificar y expirar suscripciones de usuarios vencidas
 * @returns {Promise<{checked: number, expired: number}>}
 */
export const checkExpiredUserSubscriptions = async () => {
  const now = new Date();
  const requestId = `sub-expire-${Date.now()}`;

  console.log("[WORKER JOB STARTED] checkExpiredUserSubscriptions", {
    requestId,
    timestamp: now.toISOString(),
  });

  try {
    // Buscar usuarios activos cuya suscripción ha expirado
    const expiredUsers = await User.updateMany(
      {
        role: { $ne: "god" },
        status: "active",
        subscriptionExpiresAt: { $lt: now, $ne: null },
      },
      {
        $set: {
          status: "expired",
          active: false,
        },
      }
    );

    console.log("[WORKER JOB FINISHED] checkExpiredUserSubscriptions", {
      requestId,
      checked: expiredUsers.matchedCount,
      expired: expiredUsers.modifiedCount,
      timestamp: new Date().toISOString(),
    });

    return {
      checked: expiredUsers.matchedCount,
      expired: expiredUsers.modifiedCount,
    };
  } catch (error) {
    console.error("[WORKER ERROR] checkExpiredUserSubscriptions", {
      requestId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

/**
 * Obtener usuarios con suscripciones próximas a expirar
 * @param {number} daysAhead - Días de anticipación para avisar
 * @returns {Promise<Array>}
 */
export const getExpiringSubscriptions = async (daysAhead = 7) => {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  try {
    const expiringUsers = await User.find({
      role: { $ne: "god" },
      status: "active",
      subscriptionExpiresAt: { $gte: now, $lte: futureDate },
    })
      .select("name email subscriptionExpiresAt")
      .sort({ subscriptionExpiresAt: 1 })
      .lean();

    console.log("[WORKER JOB FINISHED] getExpiringSubscriptions", {
      daysAhead,
      count: expiringUsers.length,
      timestamp: new Date().toISOString(),
    });

    return expiringUsers;
  } catch (error) {
    console.error("[WORKER ERROR] getExpiringSubscriptions", {
      daysAhead,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

/**
 * Ejecutar todas las verificaciones de suscripción
 * Llamar desde un cron job externo o endpoint protegido
 */
export const runSubscriptionChecks = async () => {
  const requestId = `sub-checks-${Date.now()}`;
  console.log("[WORKER JOB STARTED] runSubscriptionChecks", {
    requestId,
    timestamp: new Date().toISOString(),
  });

  const results = {
    timestamp: new Date().toISOString(),
    expiredUsers: { checked: 0, expired: 0 },
    expiringIn7Days: [],
    expiringIn3Days: [],
    expiringToday: [],
  };

  try {
    // 1. Expirar suscripciones vencidas
    results.expiredUsers = await checkExpiredUserSubscriptions();

    // 2. Obtener usuarios que expiran pronto (para notificaciones)
    results.expiringIn7Days = await getExpiringSubscriptions(7);
    results.expiringIn3Days = await getExpiringSubscriptions(3);
    results.expiringToday = await getExpiringSubscriptions(1);

    console.log("[WORKER JOB FINISHED] runSubscriptionChecks", {
      requestId,
      expired: results.expiredUsers.expired,
      expiringIn7Days: results.expiringIn7Days.length,
      expiringIn3Days: results.expiringIn3Days.length,
      expiringToday: results.expiringToday.length,
      timestamp: new Date().toISOString(),
    });

    return results;
  } catch (error) {
    console.error("[WORKER ERROR] runSubscriptionChecks", {
      requestId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

/**
 * Restaurar usuarios pausados que deberían estar activos
 * (caso edge: pausedRemainingMs > 0 pero status no es "paused")
 */
export const cleanupInconsistentSubscriptions = async () => {
  const requestId = `sub-cleanup-${Date.now()}`;
  console.log("[WORKER JOB STARTED] cleanupInconsistentSubscriptions", {
    requestId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Limpiar usuarios con pausedRemainingMs pero que no están pausados
    const cleaned = await User.updateMany(
      {
        status: { $ne: "paused" },
        pausedRemainingMs: { $gt: 0 },
      },
      {
        $set: { pausedRemainingMs: 0 },
      }
    );

    console.log("[WORKER JOB FINISHED] cleanupInconsistentSubscriptions", {
      requestId,
      cleaned: cleaned.modifiedCount,
      timestamp: new Date().toISOString(),
    });

    return { cleaned: cleaned.modifiedCount };
  } catch (error) {
    console.error("[WORKER ERROR] cleanupInconsistentSubscriptions", {
      requestId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};
