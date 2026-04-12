/**
 * ============================================================================
 * SYNC LOGGER - Sistema de Logging Profesional para Pipeline V2
 * ============================================================================
 *
 * Proporciona logging estructurado y colorizado para todas las operaciones
 * de sincronizaciÃ³n, validaciÃ³n y protecciÃ³n de la arquitectura dual de BD.
 *
 * @version 2.0.0
 * @date 2026-01-22
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURACIÃ“N DE COLORES (ANSI)
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",

  // Colores de texto
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Colores de fondo
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

// ============================================================================
// ICONOS Y PREFIJOS
// ============================================================================

const ICONS = {
  sync: "ðŸ”„",
  prod: "ðŸ”´",
  local: "ðŸŸ¢",
  success: "âœ…",
  error: "âŒ",
  warning: "âš ï¸",
  info: "â„¹ï¸",
  database: "ðŸ—„ï¸",
  lock: "ðŸ”’",
  unlock: "ðŸ”“",
  clock: "â±ï¸",
  document: "ðŸ“„",
  folder: "ðŸ“",
  check: "âœ“",
  cross: "âœ—",
  arrow: "â†’",
  bullet: "â€¢",
  star: "â­",
  fire: "ðŸ”¥",
  rocket: "ðŸš€",
  shield: "ðŸ›¡ï¸",
  key: "ðŸ”‘",
  gear: "âš™ï¸",
  chart: "ðŸ“Š",
  package: "ðŸ“¦",
};

// ============================================================================
// CONFIGURACIÃ“N DEL LOGGER
// ============================================================================

const CONFIG = {
  enableColors: process.stdout.isTTY !== false,
  enableTimestamps: true,
  enableFileLogging: process.env.SYNC_LOG_FILE === "true",
  logFilePath: path.join(__dirname, "..", "logs", "sync.log"),
  logLevel: process.env.SYNC_LOG_LEVEL || "info", // debug, info, warn, error
  maxLogFileSize: 10 * 1024 * 1024, // 10MB
};

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Obtiene timestamp formateado
 * @returns {string} Timestamp en formato ISO
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Obtiene timestamp corto para consola
 * @returns {string} Timestamp en formato HH:MM:SS
 */
function getShortTimestamp() {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

/**
 * Aplica color a un texto
 * @param {string} text - Texto a colorear
 * @param {string} color - Color a aplicar
 * @returns {string} Texto coloreado
 */
function colorize(text, color) {
  if (!CONFIG.enableColors) return text;
  return `${COLORS[color] || ""}${text}${COLORS.reset}`;
}

/**
 * Formatea un nÃºmero con separadores de miles
 * @param {number} num - NÃºmero a formatear
 * @returns {string} NÃºmero formateado
 */
function formatNumber(num) {
  return num.toLocaleString("es-ES");
}

/**
 * Formatea duraciÃ³n en milisegundos a formato legible
 * @param {number} ms - Milisegundos
 * @returns {string} DuraciÃ³n formateada
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * Formatea bytes a formato legible
 * @param {number} bytes - Bytes
 * @returns {string} TamaÃ±o formateado
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Escribe en archivo de log si estÃ¡ habilitado
 * @param {string} level - Nivel de log
 * @param {string} message - Mensaje
 */
function writeToFile(level, message) {
  if (!CONFIG.enableFileLogging) return;

  try {
    const logDir = path.dirname(CONFIG.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = `[${getTimestamp()}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(CONFIG.logFilePath, logEntry);
  } catch (error) {
    // Silenciar errores de escritura de log
  }
}

/**
 * Verifica si debe loggear segÃºn el nivel
 * @param {string} level - Nivel del mensaje
 * @returns {boolean} true si debe loggear
 */
function shouldLog(level) {
  return LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.logLevel];
}

// ============================================================================
// FUNCIONES DE LOGGING
// ============================================================================

/**
 * Log de sincronizaciÃ³n
 * @param {string} message - Mensaje
 */
function sync(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[SYNC]`, "cyan");
  const icon = ICONS.sync;
  console.warn("[Essence Debug]", `${icon} ${prefix} ${message}`);
  writeToFile("sync", message);
}

/**
 * Log de producciÃ³n
 * @param {string} message - Mensaje
 */
function prod(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[PROD]`, "red");
  const icon = ICONS.prod;
  console.warn("[Essence Debug]", `${icon} ${prefix} ${message}`);
  writeToFile("prod", message);
}

/**
 * Log de local
 * @param {string} message - Mensaje
 */
function local(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[LOCAL]`, "green");
  const icon = ICONS.local;
  console.warn("[Essence Debug]", `${icon} ${prefix} ${message}`);
  writeToFile("local", message);
}

/**
 * Log de informaciÃ³n
 * @param {string} message - Mensaje
 */
function info(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[INFO]`, "blue");
  console.warn("[Essence Debug]", `${ICONS.info} ${prefix} ${message}`);
  writeToFile("info", message);
}

/**
 * Log de Ã©xito
 * @param {string} message - Mensaje
 */
function success(message) {
  if (!shouldLog("info")) return;
  const coloredMessage = colorize(message, "green");
  console.warn("[Essence Debug]", `${ICONS.success} ${coloredMessage}`);
  writeToFile("success", message);
}

/**
 * Log de advertencia
 * @param {string} message - Mensaje
 */
function warn(message) {
  if (!shouldLog("warn")) return;
  const prefix = colorize(`[WARN]`, "yellow");
  console.warn("[Essence Debug]", `${ICONS.warning} ${prefix} ${colorize(message, "yellow")}`);
  writeToFile("warn", message);
}

/**
 * Log de error
 * @param {string} message - Mensaje
 */
function error(message) {
  if (!shouldLog("error")) return;
  const prefix = colorize(`[ERROR]`, "red");
  console.error(`${ICONS.error} ${prefix} ${colorize(message, "red")}`);
  writeToFile("error", message);
}

/**
 * Log de debug
 * @param {string} message - Mensaje
 */
function debug(message) {
  if (!shouldLog("debug")) return;
  const prefix = colorize(`[DEBUG]`, "gray");
  const timestamp = colorize(`[${getShortTimestamp()}]`, "gray");
  console.warn("[Essence Debug]", `${timestamp} ${prefix} ${colorize(message, "gray")}`);
  writeToFile("debug", message);
}

/**
 * Log de secciÃ³n (encabezado)
 * @param {string} title - TÃ­tulo de la secciÃ³n
 */
function section(title) {
  const line = "â•".repeat(60);
  console.warn("[Essence Debug]", "");
  console.warn("[Essence Debug]", colorize(line, "cyan"));
  console.warn("[Essence Debug]", colorize(`  ${title}`, "cyan"));
  console.warn("[Essence Debug]", colorize(line, "cyan"));
  console.warn("[Essence Debug]", "");
  writeToFile("section", title);
}

/**
 * Log de subsecciÃ³n
 * @param {string} title - TÃ­tulo
 */
function subsection(title) {
  const line = "â”€".repeat(50);
  console.warn("[Essence Debug]", "");
  console.warn("[Essence Debug]", colorize(line, "gray"));
  console.warn("[Essence Debug]", colorize(`  ${title}`, "white"));
  console.warn("[Essence Debug]", colorize(line, "gray"));
  writeToFile("subsection", title);
}

/**
 * Log de separador
 */
function separator() {
  console.warn("[Essence Debug]", colorize("â”€".repeat(60), "gray"));
}

/**
 * Log de lÃ­nea vacÃ­a
 */
function blank() {
  console.warn("[Essence Debug]", "");
}

/**
 * Log de colecciÃ³n sincronizada
 * @param {string} name - Nombre de la colecciÃ³n
 * @param {Object} stats - EstadÃ­sticas
 */
function collection(name, stats) {
  const {
    newCount = 0,
    skippedCount = 0,
    totalProd = 0,
    totalLocal = 0,
    duration = 0,
  } = stats;

  let statusIcon, statusColor;
  if (newCount > 0) {
    statusIcon = ICONS.package;
    statusColor = "green";
  } else {
    statusIcon = ICONS.check;
    statusColor = "gray";
  }

  const nameFormatted = name.padEnd(25);
  const newFormatted = colorize(
    `+${formatNumber(newCount)}`,
    newCount > 0 ? "green" : "gray",
  );
  const skippedFormatted = colorize(`~${formatNumber(skippedCount)}`, "gray");
  const durationFormatted = colorize(`(${formatDuration(duration)})`, "dim");

  console.warn("[Essence Debug]", 
    `   ${statusIcon} ${nameFormatted} ${newFormatted} nuevos, ${skippedFormatted} omitidos ${durationFormatted}`,
  );
  writeToFile(
    "collection",
    `${name}: ${newCount} nuevos, ${skippedCount} omitidos`,
  );
}

/**
 * Log de resumen de sincronizaciÃ³n
 * @param {Object} summary - Resumen de la sincronizaciÃ³n
 */
function syncSummary(summary) {
  const {
    totalNew = 0,
    totalSkipped = 0,
    totalErrors = 0,
    duration = 0,
    collectionsProcessed = 0,
  } = summary;

  separator();
  console.warn("[Essence Debug]", "");
  console.warn("[Essence Debug]", colorize("ðŸ“‹ RESUMEN DE SINCRONIZACIÃ“N", "bright"));
  separator();

  console.warn("[Essence Debug]", 
    `   ${ICONS.success} Documentos nuevos insertados: ${colorize(formatNumber(totalNew), "green")}`,
  );
  console.warn("[Essence Debug]", 
    `   ${ICONS.arrow} Documentos omitidos (ya existÃ­an): ${colorize(formatNumber(totalSkipped), "gray")}`,
  );

  if (totalErrors > 0) {
    console.warn("[Essence Debug]", 
      `   ${ICONS.error} Errores: ${colorize(formatNumber(totalErrors), "red")}`,
    );
  }

  console.warn("[Essence Debug]", 
    `   ${ICONS.folder} Colecciones procesadas: ${colorize(formatNumber(collectionsProcessed), "blue")}`,
  );
  console.warn("[Essence Debug]", 
    `   ${ICONS.clock} Tiempo total: ${colorize(formatDuration(duration), "cyan")}`,
  );

  separator();
  console.warn("[Essence Debug]", "");

  writeToFile(
    "summary",
    `SincronizaciÃ³n completada: ${totalNew} nuevos, ${totalSkipped} omitidos, ${totalErrors} errores en ${formatDuration(duration)}`,
  );
}

/**
 * Log de progreso
 * @param {number} current - Actual
 * @param {number} total - Total
 * @param {string} label - Etiqueta
 */
function progress(current, total, label = "") {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;
  const bar = "â–ˆ".repeat(filled) + "â–‘".repeat(empty);

  process.stdout.write(`\r   ${ICONS.sync} [${bar}] ${percentage}% ${label}`);

  if (current === total) {
    console.warn("[Essence Debug]", ""); // Nueva lÃ­nea al completar
  }
}

/**
 * Log de estado de Ãºltima sincronizaciÃ³n
 * @param {Date|string} lastSync - Fecha de Ãºltima sincronizaciÃ³n
 */
function lastSyncStatus(lastSync) {
  const date = lastSync ? new Date(lastSync) : null;

  if (!date || isNaN(date.getTime())) {
    console.warn("[Essence Debug]", 
      `   ${ICONS.clock} Ãšltima sincronizaciÃ³n: ${colorize("Nunca", "yellow")}`,
    );
  } else {
    const formatted = date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    console.warn("[Essence Debug]", 
      `   ${ICONS.clock} Ãšltima sincronizaciÃ³n: ${colorize(formatted, "cyan")}`,
    );
  }
}

/**
 * Log de conexiÃ³n establecida
 * @param {string} type - 'prod' o 'local'
 * @param {Object} info - InformaciÃ³n de conexiÃ³n
 */
function connectionEstablished(type, info = {}) {
  const { host = "unknown", database = "unknown" } = info;

  if (type === "prod") {
    console.warn("[Essence Debug]", 
      `   ${ICONS.prod} ${colorize("[PROD-RO]", "red")} Conectado a: ${colorize(host, "white")}`,
    );
    console.warn("[Essence Debug]", `      Base de datos: ${colorize(database, "gray")}`);
    console.warn("[Essence Debug]", `      Modo: ${colorize("SOLO LECTURA", "yellow")}`);
  } else {
    console.warn("[Essence Debug]", 
      `   ${ICONS.local} ${colorize("[LOCAL-RW]", "green")} Conectado a: ${colorize(host, "white")}`,
    );
    console.warn("[Essence Debug]", `      Base de datos: ${colorize(database, "gray")}`);
    console.warn("[Essence Debug]", `      Modo: ${colorize("LECTURA + ESCRITURA", "green")}`);
  }
}

/**
 * Log de batch procesado
 * @param {number} batchNumber - NÃºmero de batch
 * @param {number} documentsInBatch - Documentos en el batch
 * @param {number} totalProcessed - Total procesado
 */
function batchProcessed(batchNumber, documentsInBatch, totalProcessed) {
  debug(
    `Batch #${batchNumber}: ${documentsInBatch} documentos insertados (total: ${totalProcessed})`,
  );
}

/**
 * Log de protecciÃ³n activada
 * @param {string} operation - OperaciÃ³n bloqueada
 * @param {string} collection - ColecciÃ³n afectada
 */
function protectionTriggered(operation, collection) {
  warn(
    `OperaciÃ³n bloqueada: ${operation} en ${collection} (conexiÃ³n de producciÃ³n)`,
  );
  writeToFile("protection", `Bloqueado: ${operation} en ${collection}`);
}

/**
 * Log de inicio de servidor
 * @param {number} port - Puerto
 * @param {string} mode - Modo (development, production)
 */
function serverStarted(port, mode) {
  console.warn("[Essence Debug]", "");
  console.warn("[Essence Debug]", `${ICONS.rocket} ${colorize("Servidor iniciado", "green")}`);
  console.warn("[Essence Debug]", `   ${ICONS.gear} Puerto: ${colorize(String(port), "cyan")}`);
  console.warn("[Essence Debug]", `   ${ICONS.gear} Modo: ${colorize(mode, "yellow")}`);
  console.warn("[Essence Debug]", 
    `   ${ICONS.gear} URL: ${colorize(`http://localhost:${port}`, "blue")}`,
  );
  console.warn("[Essence Debug]", "");
}

/**
 * Log de tabla de estadÃ­sticas
 * @param {Array<Object>} data - Datos de la tabla
 */
function table(data) {
  console.table(data);
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export const syncLogger = {
  // Logs principales
  sync,
  prod,
  local,
  info,
  success,
  warn,
  error,
  debug,

  // Formato
  section,
  subsection,
  separator,
  blank,

  // EspecÃ­ficos de sincronizaciÃ³n
  collection,
  syncSummary,
  progress,
  lastSyncStatus,
  connectionEstablished,
  batchProcessed,
  protectionTriggered,
  serverStarted,
  table,

  // Utilidades
  formatNumber,
  formatDuration,
  formatBytes,
  colorize,

  // Iconos y colores
  ICONS,
  COLORS,
};

export default syncLogger;

