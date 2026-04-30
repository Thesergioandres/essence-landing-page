import { runSync } from "./syncProdToLocalV2.job.js";
import { syncLogger } from "../../../utils/syncLogger.js";

let workerInterval = null;
let isSyncing = false;
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Inicia el worker de espejo de producción.
 * Realiza una sincronización incremental periódica.
 */
export async function startProductionMirrorWorker() {
  if (workerInterval) {
    syncLogger.warn("[MIRROR WORKER] El worker ya está en ejecución.");
    return;
  }

  syncLogger.info("[MIRROR WORKER] Iniciando worker de espejo de producción...");
  syncLogger.info(`[MIRROR WORKER] Intervalo de sincronización: ${SYNC_INTERVAL_MS / 60000} minutos.`);

  // Función de sincronización
  const performSync = async () => {
    if (isSyncing) {
      syncLogger.warn("[MIRROR WORKER] Sincronización en curso, saltando ciclo.");
      return;
    }

    isSyncing = true;
    try {
      syncLogger.section("MIRROR WORKER: SINCRONIZACIÓN AUTOMÁTICA");
      const result = await runSync();
      if (result.success) {
        syncLogger.success("[MIRROR WORKER] Sincronización periódica completada.");
      } else {
        syncLogger.warn("[MIRROR WORKER] Sincronización periódica completada con advertencias.");
      }
    } catch (error) {
      syncLogger.error(`[MIRROR WORKER] Error en sincronización periódica: ${error.message}`);
    } finally {
      isSyncing = false;
    }
  };

  // Programar el intervalo
  workerInterval = setInterval(performSync, SYNC_INTERVAL_MS);

  syncLogger.success("[MIRROR WORKER] Worker de espejo de producción activo en segundo plano.");
}

/**
 * Detiene el worker de espejo de producción.
 */
export function stopProductionMirrorWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    syncLogger.info("[MIRROR WORKER] Worker de espejo de producción detenido.");
  }
}

export default {
  startProductionMirrorWorker,
  stopProductionMirrorWorker
};
