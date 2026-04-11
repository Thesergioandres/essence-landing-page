/**
 * ============================================================================
 * SINCRONIZACIÓN PRODUCCIÓN → LOCAL V2
 * ============================================================================
 *
 * Script de sincronización avanzado basado en timestamps.
 * Solo sincroniza documentos con updatedAt > lastSyncDate.
 *
 * Características:
 * - Sincronización incremental por timestamps
 * - Procesamiento en paralelo de colecciones
 * - Batch inserts configurables (500-2000 docs)
 * - Nunca sobrescribe documentos locales
 * - Nunca elimina documentos locales
 * - Guarda estado en sync-state.json
 *
 * @version 2.0.0
 * @date 2026-01-22
 */

import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { validateProdReadOnlyPermissions } from "../../../config/validateProdReadOnlyPermissions.js";
import { installFullProtection } from "../../../security/mongooseWriteProtector.js";
import { syncLogger } from "../../../utils/syncLogger.js";
import { resolveProductionMongoSource } from "../database/utils/resolveProductionMongoUri.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, "../../..", ".env") });

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const prodMongoSource = resolveProductionMongoSource(process.env);

const CONFIG = {
  // URIs de bases de datos
  PROD_URI: prodMongoSource.uri,
  PROD_URI_SOURCE: prodMongoSource.source,
  PROD_URI_WARNINGS: prodMongoSource.warnings,
  LOCAL_URI:
    process.env.MONGO_URI_DEV ||
    process.env.MONGO_URI_DEV_LOCAL ||
    "mongodb://localhost:27017/essence_local",

  // Archivo de estado
  STATE_FILE: path.join(__dirname, "../../..", "data", "sync-state.json"),

  // Configuración de batches
  BATCH_SIZE: parseInt(process.env.SYNC_BATCH_SIZE) || 1000,
  MIN_BATCH_SIZE: 100,
  MAX_BATCH_SIZE: 2000,

  // Paralelización
  PARALLEL_COLLECTIONS: parseInt(process.env.SYNC_PARALLEL) || 3,

  // Timeouts
  CONNECTION_TIMEOUT: 30000,
  OPERATION_TIMEOUT: 60000,

  // Reintentos
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,

  // Modo
  FORCE_FULL_SYNC: process.env.SYNC_FORCE_FULL === "true",
  DRY_RUN: process.env.SYNC_DRY_RUN === "true",
  SKIP_VALIDATION: process.env.SYNC_SKIP_VALIDATION === "true",
  ALLOW_DANGEROUS_PROD_CREDENTIALS:
    process.env.SYNC_ALLOW_DANGEROUS_PROD_CREDENTIALS !== "false",
};

/**
 * Colecciones a sincronizar en orden de dependencia
 */
const COLLECTIONS_TO_SYNC = [
  // Nivel 1: Sin dependencias
  { name: "users", priority: 1, timestampField: "updatedAt" },
  { name: "businesses", priority: 1, timestampField: "updatedAt" },
  { name: "categories", priority: 1, timestampField: "updatedAt" },
  { name: "paymentmethods", priority: 1, timestampField: "updatedAt" },
  { name: "deliverymethods", priority: 1, timestampField: "updatedAt" },
  { name: "providers", priority: 1, timestampField: "updatedAt" },
  { name: "segments", priority: 1, timestampField: "updatedAt" },
  { name: "gamificationconfigs", priority: 1, timestampField: "updatedAt" },

  // Nivel 2: Dependencias de nivel 1
  { name: "products", priority: 2, timestampField: "updatedAt" },
  { name: "branches", priority: 2, timestampField: "updatedAt" },
  { name: "memberships", priority: 2, timestampField: "updatedAt" },
  { name: "customers", priority: 2, timestampField: "updatedAt" },
  { name: "promotions", priority: 2, timestampField: "updatedAt" },

  // Nivel 3: Dependencias de nivel 2
  { name: "stocks", priority: 3, timestampField: "updatedAt" },
  { name: "branchstocks", priority: 3, timestampField: "updatedAt" },
  { name: "distributorstocks", priority: 3, timestampField: "updatedAt" },
  { name: "distributorsstats", priority: 3, timestampField: "updatedAt" },

  // Nivel 4: Transacciones
  { name: "sales", priority: 4, timestampField: "createdAt" },
  { name: "specialsales", priority: 4, timestampField: "createdAt" },
  { name: "credits", priority: 4, timestampField: "createdAt" },
  { name: "expenses", priority: 4, timestampField: "createdAt" },
  { name: "inventoryentries", priority: 4, timestampField: "createdAt" },

  // Nivel 5: Dependencias de transacciones
  { name: "creditpayments", priority: 5, timestampField: "createdAt" },
  { name: "stocktransfers", priority: 5, timestampField: "createdAt" },
  { name: "branchtransfers", priority: 5, timestampField: "createdAt" },
  { name: "defectiveproducts", priority: 5, timestampField: "createdAt" },

  // Nivel 6: Registros y logs
  { name: "notifications", priority: 6, timestampField: "createdAt" },
  { name: "auditlogs", priority: 6, timestampField: "createdAt" },
  { name: "profithistories", priority: 6, timestampField: "createdAt" },
  { name: "periodwinners", priority: 6, timestampField: "createdAt" },
  { name: "pushsubscriptions", priority: 6, timestampField: "createdAt" },
];

// ============================================================================
// CONEXIONES
// ============================================================================

let prodConnection = null;
let localConnection = null;

/**
 * Establece conexión con la base de datos de producción (read-only)
 * @returns {Promise<mongoose.Connection>}
 */
async function connectToProd() {
  if (!CONFIG.PROD_URI) {
    throw new Error(
      "No se encontró URI de producción (MONGO_URI_PROD / MONGO_PUBLIC_URL / RAILWAY_TCP_PROXY_* / MONGO_URI_PROD_READ)",
    );
  }

  if (CONFIG.PROD_URI_SOURCE) {
    syncLogger.info(
      `Fuente de mirror producción detectada: ${CONFIG.PROD_URI_SOURCE}`,
    );
  }

  syncLogger.info("Conectando a producción (read-only)...");

  prodConnection = await mongoose
    .createConnection(CONFIG.PROD_URI, {
      serverSelectionTimeoutMS: CONFIG.CONNECTION_TIMEOUT,
      socketTimeoutMS: CONFIG.OPERATION_TIMEOUT,
      maxPoolSize: 5,
      readPreference: "secondaryPreferred",
      readConcern: { level: "majority" },
    })
    .asPromise();

  // Instalar protección de escritura
  installFullProtection(prodConnection, { enableGlobalProtection: false });

  const host = prodConnection.host || "cluster";
  const dbName = prodConnection.name || "unknown";

  syncLogger.connectionEstablished("prod", { host, database: dbName });

  return prodConnection;
}

/**
 * Establece conexión con la base de datos local (read-write)
 * @returns {Promise<mongoose.Connection>}
 */
async function connectToLocal() {
  if (!CONFIG.LOCAL_URI) {
    throw new Error("MONGO_URI_DEV no está configurada");
  }

  // Validar que no sea la misma URI que producción
  if (CONFIG.LOCAL_URI === CONFIG.PROD_URI) {
    throw new Error("Las URIs de producción y local no pueden ser iguales");
  }

  syncLogger.info("Conectando a base de datos local...");

  localConnection = await mongoose
    .createConnection(CONFIG.LOCAL_URI, {
      serverSelectionTimeoutMS: CONFIG.CONNECTION_TIMEOUT,
      socketTimeoutMS: CONFIG.OPERATION_TIMEOUT,
      maxPoolSize: 10,
    })
    .asPromise();

  const host = localConnection.host || "localhost";
  const dbName = localConnection.name || "essence_local";

  syncLogger.connectionEstablished("local", { host, database: dbName });

  return localConnection;
}

/**
 * Cierra todas las conexiones
 */
async function closeConnections() {
  if (prodConnection) {
    await prodConnection.close();
    syncLogger.debug("Conexión de producción cerrada");
  }
  if (localConnection) {
    await localConnection.close();
    syncLogger.debug("Conexión local cerrada");
  }
}

// ============================================================================
// ESTADO DE SINCRONIZACIÓN
// ============================================================================

/**
 * Carga el estado de sincronización desde el archivo
 * @returns {Object} Estado de sincronización
 */
function loadSyncState() {
  try {
    // Asegurar que el directorio existe
    const dir = path.dirname(CONFIG.STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(CONFIG.STATE_FILE)) {
      const content = fs.readFileSync(CONFIG.STATE_FILE, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    syncLogger.warn(
      `Error cargando estado de sincronización: ${error.message}`,
    );
  }

  // Estado por defecto
  return {
    lastSyncDate: null,
    lastSuccessfulSync: null,
    collections: {},
    stats: {
      totalSyncs: 0,
      totalDocumentsImported: 0,
      totalDocumentsSkipped: 0,
      totalErrors: 0,
      averageDuration: 0,
    },
    version: "2.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

/**
 * Guarda el estado de sincronización
 * @param {Object} state - Estado a guardar
 */
function saveSyncState(state) {
  try {
    state.updatedAt = new Date().toISOString();

    const dir = path.dirname(CONFIG.STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(state, null, 2));
    syncLogger.debug("Estado de sincronización guardado");
  } catch (error) {
    syncLogger.error(
      `Error guardando estado de sincronización: ${error.message}`,
    );
  }
}

/**
 * Obtiene la fecha de última sincronización para una colección
 * @param {Object} state - Estado de sincronización
 * @param {string} collectionName - Nombre de la colección
 * @returns {Date|null} Fecha de última sincronización
 */
function getLastSyncDate(state, collectionName) {
  if (CONFIG.FORCE_FULL_SYNC) {
    return null;
  }

  const collectionState = state.collections[collectionName];
  if (collectionState?.lastSyncDate) {
    return new Date(collectionState.lastSyncDate);
  }

  return null;
}

// ============================================================================
// SINCRONIZACIÓN DE COLECCIONES
// ============================================================================

/**
 * Sincroniza una colección individual
 * @param {Object} collectionConfig - Configuración de la colección
 * @param {Object} state - Estado de sincronización
 * @returns {Promise<Object>} Resultado de la sincronización
 */
async function syncCollection(collectionConfig, state) {
  const { name, timestampField } = collectionConfig;
  const startTime = Date.now();

  const result = {
    collection: name,
    newCount: 0,
    skippedCount: 0,
    errorCount: 0,
    duration: 0,
    lastDocumentDate: null,
  };

  try {
    const prodCollection = prodConnection.db.collection(name);
    const localCollection = localConnection.db.collection(name);

    // Obtener fecha de última sincronización
    let lastSyncDate = getLastSyncDate(state, name);
    if (lastSyncDate && !CONFIG.FORCE_FULL_SYNC) {
      const localCount = await localCollection.estimatedDocumentCount();
      if (localCount === 0) {
        syncLogger.warn(
          `${name}: colección local vacía, forzando sync completa`,
        );
        lastSyncDate = null;
      }
    }

    // Construir query basado en timestamp
    let query = {};
    if (lastSyncDate && timestampField) {
      query[timestampField] = { $gt: lastSyncDate };
      syncLogger.debug(
        `${name}: Buscando documentos con ${timestampField} > ${lastSyncDate.toISOString()}`,
      );
    }

    // Contar documentos a procesar
    const totalProdCount = await prodCollection.countDocuments(query);

    if (totalProdCount === 0) {
      result.duration = Date.now() - startTime;
      syncLogger.collection(name, result);
      return result;
    }

    // Obtener todos los IDs locales para verificación rápida
    const localIds = new Set();
    const localCursor = localCollection.find({}, { projection: { _id: 1 } });

    for await (const doc of localCursor) {
      localIds.add(doc._id.toString());
    }

    syncLogger.debug(`${name}: ${localIds.size} documentos locales existentes`);

    // Procesar documentos de producción en batches
    const cursor = prodCollection.find(query).sort({ [timestampField]: 1 });
    let batch = [];
    let processedCount = 0;

    for await (const doc of cursor) {
      const docId = doc._id.toString();

      // Verificar si ya existe localmente
      if (localIds.has(docId)) {
        result.skippedCount++;
        processedCount++;
        continue;
      }

      // Agregar al batch
      batch.push(doc);

      // Track última fecha del documento
      if (doc[timestampField]) {
        result.lastDocumentDate = doc[timestampField];
      }

      // Insertar batch si está lleno
      if (batch.length >= CONFIG.BATCH_SIZE) {
        if (!CONFIG.DRY_RUN) {
          try {
            await localCollection.insertMany(batch, { ordered: false });
            result.newCount += batch.length;
            syncLogger.batchProcessed(
              Math.ceil(processedCount / CONFIG.BATCH_SIZE),
              batch.length,
              result.newCount,
            );
          } catch (error) {
            // Manejar errores de duplicados
            if (error.code === 11000) {
              // Algunos documentos ya existían
              const insertedCount = error.result?.nInserted || 0;
              result.newCount += insertedCount;
              result.skippedCount += batch.length - insertedCount;
            } else {
              result.errorCount += batch.length;
              syncLogger.error(`Error en batch de ${name}: ${error.message}`);
            }
          }
        } else {
          result.newCount += batch.length;
        }

        batch = [];
      }

      processedCount++;

      // Mostrar progreso cada 10%
      if (processedCount % Math.ceil(totalProdCount / 10) === 0) {
        syncLogger.progress(processedCount, totalProdCount, name);
      }
    }

    // Insertar batch final
    if (batch.length > 0) {
      if (!CONFIG.DRY_RUN) {
        try {
          await localCollection.insertMany(batch, { ordered: false });
          result.newCount += batch.length;
        } catch (error) {
          if (error.code === 11000) {
            const insertedCount = error.result?.nInserted || 0;
            result.newCount += insertedCount;
            result.skippedCount += batch.length - insertedCount;
          } else {
            result.errorCount += batch.length;
            syncLogger.error(
              `Error en batch final de ${name}: ${error.message}`,
            );
          }
        }
      } else {
        result.newCount += batch.length;
      }
    }

    result.duration = Date.now() - startTime;
    syncLogger.collection(name, result);

    return result;
  } catch (error) {
    result.errorCount++;
    result.duration = Date.now() - startTime;
    syncLogger.error(`Error sincronizando ${name}: ${error.message}`);
    return result;
  }
}

/**
 * Sincroniza un grupo de colecciones en paralelo
 * @param {Array} collections - Colecciones a sincronizar
 * @param {Object} state - Estado de sincronización
 * @returns {Promise<Array>} Resultados de sincronización
 */
async function syncCollectionsParallel(collections, state) {
  const results = [];

  // Procesar en chunks según el límite de paralelización
  for (let i = 0; i < collections.length; i += CONFIG.PARALLEL_COLLECTIONS) {
    const chunk = collections.slice(i, i + CONFIG.PARALLEL_COLLECTIONS);
    const chunkResults = await Promise.all(
      chunk.map((col) => syncCollection(col, state)),
    );
    results.push(...chunkResults);
  }

  return results;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Ejecuta la sincronización completa
 * @returns {Promise<Object>} Resultado de la sincronización
 */
async function runSync() {
  const syncStartTime = Date.now();

  syncLogger.section("SINCRONIZACIÓN V2: PRODUCCIÓN → LOCAL");

  if (CONFIG.DRY_RUN) {
    syncLogger.warn("MODO DRY RUN ACTIVO: No se realizarán cambios reales");
  }

  if (CONFIG.FORCE_FULL_SYNC) {
    syncLogger.warn("SINCRONIZACIÓN COMPLETA FORZADA: Ignorando timestamps");
  }

  if (Array.isArray(CONFIG.PROD_URI_WARNINGS)) {
    for (const warning of CONFIG.PROD_URI_WARNINGS) {
      syncLogger.warn(warning);
    }
  }

  // Cargar estado
  const state = loadSyncState();
  syncLogger.lastSyncStatus(state.lastSuccessfulSync);

  try {
    // Conectar a ambas bases de datos
    syncLogger.subsection("Conectando a bases de datos");
    await connectToProd();
    await connectToLocal();

    // Validar permisos de producción (a menos que se omita)
    if (!CONFIG.SKIP_VALIDATION) {
      syncLogger.subsection("Validando permisos de producción");
      await validateProdReadOnlyPermissions(prodConnection, {
        strictMode: true,
        exitOnFail: true,
        allowDangerousRolesIfWriteBlocked:
          CONFIG.ALLOW_DANGEROUS_PROD_CREDENTIALS,
      });
    } else {
      syncLogger.warn(
        "Validación de permisos omitida (SYNC_SKIP_VALIDATION=true)",
      );
    }

    // Agrupar colecciones por prioridad
    const priorityGroups = {};
    for (const col of COLLECTIONS_TO_SYNC) {
      const priority = col.priority || 1;
      if (!priorityGroups[priority]) {
        priorityGroups[priority] = [];
      }
      priorityGroups[priority].push(col);
    }

    // Sincronizar por prioridad
    syncLogger.subsection("Sincronizando colecciones");

    const allResults = [];
    const priorities = Object.keys(priorityGroups).sort((a, b) => a - b);

    for (const priority of priorities) {
      syncLogger.debug(`Procesando prioridad ${priority}...`);
      const results = await syncCollectionsParallel(
        priorityGroups[priority],
        state,
      );
      allResults.push(...results);

      // Actualizar estado después de cada grupo de prioridad
      for (const result of results) {
        state.collections[result.collection] = {
          lastSyncDate: result.lastDocumentDate || new Date().toISOString(),
          lastNewCount: result.newCount,
          lastSkippedCount: result.skippedCount,
          lastDuration: result.duration,
        };
      }
    }

    // Calcular totales
    const totalNew = allResults.reduce((sum, r) => sum + r.newCount, 0);
    const totalSkipped = allResults.reduce((sum, r) => sum + r.skippedCount, 0);
    const totalErrors = allResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalDuration = Date.now() - syncStartTime;

    // Actualizar estadísticas globales
    state.lastSyncDate = new Date().toISOString();
    if (totalErrors === 0) {
      state.lastSuccessfulSync = state.lastSyncDate;
    }
    state.stats.totalSyncs++;
    state.stats.totalDocumentsImported += totalNew;
    state.stats.totalDocumentsSkipped += totalSkipped;
    state.stats.totalErrors += totalErrors;
    state.stats.averageDuration = Math.round(
      (state.stats.averageDuration * (state.stats.totalSyncs - 1) +
        totalDuration) /
        state.stats.totalSyncs,
    );

    // Guardar estado
    saveSyncState(state);

    // Mostrar resumen
    syncLogger.syncSummary({
      totalNew,
      totalSkipped,
      totalErrors,
      duration: totalDuration,
      collectionsProcessed: allResults.length,
    });

    syncLogger.sync(`Última sincronización: ${state.lastSyncDate}`);

    return {
      success: totalErrors === 0,
      totalNew,
      totalSkipped,
      totalErrors,
      duration: totalDuration,
      collectionsProcessed: allResults.length,
      results: allResults,
    };
  } catch (error) {
    syncLogger.error(`Error durante sincronización: ${error.message}`);
    throw error;
  } finally {
    await closeConnections();
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

// Ejecutar si es el módulo principal
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("syncProdToLocalV2.job.js") ||
    process.argv[1].includes("syncProdToLocalV2"));

if (isMainModule) {
  runSync()
    .then((result) => {
      if (result.success) {
        syncLogger.success("Sincronización V2 completada exitosamente");
        process.exit(0);
      } else {
        syncLogger.warn("Sincronización V2 completada con errores");
        process.exit(1);
      }
    })
    .catch((error) => {
      syncLogger.error(`Sincronización V2 fallida: ${error.message}`);
      process.exit(1);
    });
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export {
  closeConnections,
  COLLECTIONS_TO_SYNC,
  CONFIG,
  connectToLocal,
  connectToProd,
  loadSyncState,
  runSync,
  saveSyncState,
};

export default runSync;
