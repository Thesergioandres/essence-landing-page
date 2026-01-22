/**
 * ============================================================================
 * SYNC LOGGER - Sistema de Logging Profesional para Pipeline V2
 * ============================================================================
 *
 * Proporciona logging estructurado y colorizado para todas las operaciones
 * de sincronización, validación y protección de la arquitectura dual de BD.
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
// CONFIGURACIÓN DE COLORES (ANSI)
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
  sync: "🔄",
  prod: "🔴",
  local: "🟢",
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  database: "🗄️",
  lock: "🔒",
  unlock: "🔓",
  clock: "⏱️",
  document: "📄",
  folder: "📁",
  check: "✓",
  cross: "✗",
  arrow: "→",
  bullet: "•",
  star: "⭐",
  fire: "🔥",
  rocket: "🚀",
  shield: "🛡️",
  key: "🔑",
  gear: "⚙️",
  chart: "📊",
  package: "📦",
};

// ============================================================================
// CONFIGURACIÓN DEL LOGGER
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
 * Formatea un número con separadores de miles
 * @param {number} num - Número a formatear
 * @returns {string} Número formateado
 */
function formatNumber(num) {
  return num.toLocaleString("es-ES");
}

/**
 * Formatea duración en milisegundos a formato legible
 * @param {number} ms - Milisegundos
 * @returns {string} Duración formateada
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
 * @returns {string} Tamaño formateado
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Escribe en archivo de log si está habilitado
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
 * Verifica si debe loggear según el nivel
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
 * Log de sincronización
 * @param {string} message - Mensaje
 */
function sync(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[SYNC]`, "cyan");
  const icon = ICONS.sync;
  console.log(`${icon} ${prefix} ${message}`);
  writeToFile("sync", message);
}

/**
 * Log de producción
 * @param {string} message - Mensaje
 */
function prod(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[PROD]`, "red");
  const icon = ICONS.prod;
  console.log(`${icon} ${prefix} ${message}`);
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
  console.log(`${icon} ${prefix} ${message}`);
  writeToFile("local", message);
}

/**
 * Log de información
 * @param {string} message - Mensaje
 */
function info(message) {
  if (!shouldLog("info")) return;
  const prefix = colorize(`[INFO]`, "blue");
  console.log(`${ICONS.info} ${prefix} ${message}`);
  writeToFile("info", message);
}

/**
 * Log de éxito
 * @param {string} message - Mensaje
 */
function success(message) {
  if (!shouldLog("info")) return;
  const coloredMessage = colorize(message, "green");
  console.log(`${ICONS.success} ${coloredMessage}`);
  writeToFile("success", message);
}

/**
 * Log de advertencia
 * @param {string} message - Mensaje
 */
function warn(message) {
  if (!shouldLog("warn")) return;
  const prefix = colorize(`[WARN]`, "yellow");
  console.log(`${ICONS.warning} ${prefix} ${colorize(message, "yellow")}`);
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
  console.log(`${timestamp} ${prefix} ${colorize(message, "gray")}`);
  writeToFile("debug", message);
}

/**
 * Log de sección (encabezado)
 * @param {string} title - Título de la sección
 */
function section(title) {
  const line = "═".repeat(60);
  console.log("");
  console.log(colorize(line, "cyan"));
  console.log(colorize(`  ${title}`, "cyan"));
  console.log(colorize(line, "cyan"));
  console.log("");
  writeToFile("section", title);
}

/**
 * Log de subsección
 * @param {string} title - Título
 */
function subsection(title) {
  const line = "─".repeat(50);
  console.log("");
  console.log(colorize(line, "gray"));
  console.log(colorize(`  ${title}`, "white"));
  console.log(colorize(line, "gray"));
  writeToFile("subsection", title);
}

/**
 * Log de separador
 */
function separator() {
  console.log(colorize("─".repeat(60), "gray"));
}

/**
 * Log de línea vacía
 */
function blank() {
  console.log("");
}

/**
 * Log de colección sincronizada
 * @param {string} name - Nombre de la colección
 * @param {Object} stats - Estadísticas
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

  console.log(
    `   ${statusIcon} ${nameFormatted} ${newFormatted} nuevos, ${skippedFormatted} omitidos ${durationFormatted}`,
  );
  writeToFile(
    "collection",
    `${name}: ${newCount} nuevos, ${skippedCount} omitidos`,
  );
}

/**
 * Log de resumen de sincronización
 * @param {Object} summary - Resumen de la sincronización
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
  console.log("");
  console.log(colorize("📋 RESUMEN DE SINCRONIZACIÓN", "bright"));
  separator();

  console.log(
    `   ${ICONS.success} Documentos nuevos insertados: ${colorize(formatNumber(totalNew), "green")}`,
  );
  console.log(
    `   ${ICONS.arrow} Documentos omitidos (ya existían): ${colorize(formatNumber(totalSkipped), "gray")}`,
  );

  if (totalErrors > 0) {
    console.log(
      `   ${ICONS.error} Errores: ${colorize(formatNumber(totalErrors), "red")}`,
    );
  }

  console.log(
    `   ${ICONS.folder} Colecciones procesadas: ${colorize(formatNumber(collectionsProcessed), "blue")}`,
  );
  console.log(
    `   ${ICONS.clock} Tiempo total: ${colorize(formatDuration(duration), "cyan")}`,
  );

  separator();
  console.log("");

  writeToFile(
    "summary",
    `Sincronización completada: ${totalNew} nuevos, ${totalSkipped} omitidos, ${totalErrors} errores en ${formatDuration(duration)}`,
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
  const bar = "█".repeat(filled) + "░".repeat(empty);

  process.stdout.write(`\r   ${ICONS.sync} [${bar}] ${percentage}% ${label}`);

  if (current === total) {
    console.log(""); // Nueva línea al completar
  }
}

/**
 * Log de estado de última sincronización
 * @param {Date|string} lastSync - Fecha de última sincronización
 */
function lastSyncStatus(lastSync) {
  const date = lastSync ? new Date(lastSync) : null;

  if (!date || isNaN(date.getTime())) {
    console.log(
      `   ${ICONS.clock} Última sincronización: ${colorize("Nunca", "yellow")}`,
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
    console.log(
      `   ${ICONS.clock} Última sincronización: ${colorize(formatted, "cyan")}`,
    );
  }
}

/**
 * Log de conexión establecida
 * @param {string} type - 'prod' o 'local'
 * @param {Object} info - Información de conexión
 */
function connectionEstablished(type, info = {}) {
  const { host = "unknown", database = "unknown" } = info;

  if (type === "prod") {
    console.log(
      `   ${ICONS.prod} ${colorize("[PROD-RO]", "red")} Conectado a: ${colorize(host, "white")}`,
    );
    console.log(`      Base de datos: ${colorize(database, "gray")}`);
    console.log(`      Modo: ${colorize("SOLO LECTURA", "yellow")}`);
  } else {
    console.log(
      `   ${ICONS.local} ${colorize("[LOCAL-RW]", "green")} Conectado a: ${colorize(host, "white")}`,
    );
    console.log(`      Base de datos: ${colorize(database, "gray")}`);
    console.log(`      Modo: ${colorize("LECTURA + ESCRITURA", "green")}`);
  }
}

/**
 * Log de batch procesado
 * @param {number} batchNumber - Número de batch
 * @param {number} documentsInBatch - Documentos en el batch
 * @param {number} totalProcessed - Total procesado
 */
function batchProcessed(batchNumber, documentsInBatch, totalProcessed) {
  debug(
    `Batch #${batchNumber}: ${documentsInBatch} documentos insertados (total: ${totalProcessed})`,
  );
}

/**
 * Log de protección activada
 * @param {string} operation - Operación bloqueada
 * @param {string} collection - Colección afectada
 */
function protectionTriggered(operation, collection) {
  warn(
    `Operación bloqueada: ${operation} en ${collection} (conexión de producción)`,
  );
  writeToFile("protection", `Bloqueado: ${operation} en ${collection}`);
}

/**
 * Log de inicio de servidor
 * @param {number} port - Puerto
 * @param {string} mode - Modo (development, production)
 */
function serverStarted(port, mode) {
  console.log("");
  console.log(`${ICONS.rocket} ${colorize("Servidor iniciado", "green")}`);
  console.log(`   ${ICONS.gear} Puerto: ${colorize(String(port), "cyan")}`);
  console.log(`   ${ICONS.gear} Modo: ${colorize(mode, "yellow")}`);
  console.log(
    `   ${ICONS.gear} URL: ${colorize(`http://localhost:${port}`, "blue")}`,
  );
  console.log("");
}

/**
 * Log de tabla de estadísticas
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

  // Específicos de sincronización
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
