/**
 * Worker BullMQ para notificaciones de deudas vencidas
 * Cumple con requerimiento: [WORKER JOB STARTED/FINISHED] notify_debt_overdue
 */
import { Queue, Worker } from "bullmq";
import Credit from "../src/infrastructure/database/models/Credit.js";
import Customer from "../src/infrastructure/database/models/Customer.js";
import Notification from "../src/infrastructure/database/models/Notification.js";
import {
  logWorkerError,
  logWorkerJobFinished,
  logWorkerJobStarted,
} from "../utils/logger.js";

let worker;
let queue;

const QUEUE_NAME = "debt-notifications";

const getConnection = () => {
  if (!process.env.REDIS_URL) return null;
  return process.env.REDIS_URL;
};

/**
 * Obtener la cola de notificaciones de deuda
 */
export const getDebtNotificationQueue = () => {
  if (queue) return queue;

  const connection = getConnection();
  if (!connection) return null;

  queue = new Queue(QUEUE_NAME, { connection });
  return queue;
};

/**
 * Procesar un job de notificación de deuda vencida
 */
const processDebtNotification = async (job) => {
  const {
    businessId,
    creditId,
    customerId,
    amount,
    customerName,
    daysOverdue,
  } = job.data || {};

  logWorkerJobStarted({
    jobName: "notify_debt_overdue",
    jobId: job.id,
    businessId,
    extra: { creditId, customerId, amount, daysOverdue },
  });

  try {
    // Verificar que el crédito sigue vencido
    const credit = await Credit.findById(creditId);
    if (!credit || credit.status === "paid" || credit.status === "cancelled") {
      logWorkerJobFinished({
        jobName: "notify_debt_overdue",
        jobId: job.id,
        businessId,
        success: true,
        extra: { skipped: true, reason: "credit_resolved" },
      });
      return { skipped: true, reason: "credit_resolved" };
    }

    // Crear notificación para admin
    await Notification.create({
      business: businessId,
      targetRole: "admin",
      type: "credit_overdue",
      title: "Deuda vencida",
      message: `El cliente ${customerName} tiene una deuda vencida de $${amount.toFixed(
        2
      )} (${daysOverdue} días)`,
      priority: daysOverdue > 30 ? "high" : "medium",
      link: `/admin/credits?customer=${customerId}`,
      relatedEntity: { type: "Credit", id: creditId },
    });

    // Actualizar estado del cliente si es necesario
    if (daysOverdue > 60) {
      await Customer.findByIdAndUpdate(customerId, {
        $addToSet: { segments: "moroso" },
      });
    }

    logWorkerJobFinished({
      jobName: "notify_debt_overdue",
      jobId: job.id,
      businessId,
      success: true,
      extra: { creditId, notificationSent: true },
    });

    return { success: true, creditId };
  } catch (error) {
    logWorkerError({
      jobName: "notify_debt_overdue",
      jobId: job.id,
      businessId,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Iniciar el worker de notificaciones de deuda
 */
export const startDebtNotificationWorker = () => {
  if (worker) return worker;

  const connection = getConnection();
  if (!connection) {
    console.log(
      "[WORKER INFO] Redis no configurado, worker de deudas deshabilitado"
    );
    return null;
  }

  worker = new Worker(QUEUE_NAME, processDebtNotification, { connection });

  worker.on("failed", (job, err) => {
    logWorkerError({
      jobName: "notify_debt_overdue",
      jobId: job?.id,
      message: err?.message || "Job failed",
      stack: err?.stack,
    });
  });

  worker.on("completed", (job) => {
    logWorkerJobFinished({
      jobName: "notify_debt_overdue",
      jobId: job?.id,
      success: true,
    });
  });

  console.log("[WORKER INFO] Debt notification worker started");
  return worker;
};

/**
 * Encolar notificación de deuda vencida
 */
export const queueDebtNotification = async (data) => {
  const q = getDebtNotificationQueue();
  if (!q) {
    console.warn("[WORKER WARN] Queue no disponible, ejecutando síncronamente");
    // Fallback síncrono si no hay Redis
    return processDebtNotification({ id: `sync-${Date.now()}`, data });
  }

  return q.add("notify_debt_overdue", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
};

/**
 * Verificar y encolar todas las deudas vencidas de un negocio
 */
export const checkAndQueueOverdueDebts = async (businessId, requestId) => {
  logWorkerJobStarted({
    jobName: "check_overdue_debts",
    jobId: requestId,
    businessId,
  });

  try {
    const now = new Date();
    const overdueCredits = await Credit.find({
      business: businessId,
      status: { $in: ["pending", "partial"] },
      dueDate: { $lt: now },
    }).populate("customer", "name");

    let queuedCount = 0;

    for (const credit of overdueCredits) {
      const daysOverdue = Math.floor(
        (now.getTime() - credit.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Solo notificar cada 7 días para evitar spam
      const shouldNotify =
        daysOverdue === 1 ||
        daysOverdue === 7 ||
        daysOverdue === 14 ||
        daysOverdue === 30 ||
        daysOverdue % 30 === 0;

      if (shouldNotify) {
        await queueDebtNotification({
          businessId: businessId.toString(),
          creditId: credit._id.toString(),
          customerId: credit.customer?._id?.toString(),
          customerName: credit.customer?.name || "Cliente",
          amount: credit.remainingAmount,
          daysOverdue,
        });
        queuedCount++;
      }

      // Actualizar estado si no está marcado como overdue
      if (credit.status !== "overdue") {
        credit.status = "overdue";
        credit.statusHistory.push({
          status: "overdue",
          changedAt: now,
          note: `Marcado como vencido automáticamente (${daysOverdue} días)`,
        });
        await credit.save();
      }
    }

    logWorkerJobFinished({
      jobName: "check_overdue_debts",
      jobId: requestId,
      businessId,
      success: true,
      extra: {
        overdueCount: overdueCredits.length,
        queuedNotifications: queuedCount,
      },
    });

    return {
      overdueCount: overdueCredits.length,
      queuedNotifications: queuedCount,
    };
  } catch (error) {
    logWorkerError({
      jobName: "check_overdue_debts",
      jobId: requestId,
      businessId,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};
