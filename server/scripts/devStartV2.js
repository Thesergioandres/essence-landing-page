#!/usr/bin/env node

/**
 * ============================================================================
 * DEV START V2 - Pipeline de Desarrollo Seguro
 * ============================================================================
 *
 * Script de inicio de desarrollo que ejecuta:
 * 1. Validación de permisos read-only en producción
 * 2. Sincronización V2 (basada en timestamps)
 * 3. Inicio del servidor
 *
 * @version 2.0.0
 * @date 2026-01-22
 */

import { fork, spawn } from "child_process";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.join(__dirname, "..");

// Cargar variables de entorno
dotenv.config({ path: path.join(SERVER_DIR, ".env") });

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
  PROD_URI: process.env.MONGO_URI_PROD_READ,
  LOCAL_URI:
    process.env.MONGO_URI_DEV_LOCAL ||
    "mongodb://localhost:27017/essence_local",
  SKIP_SYNC: process.env.DEV_SKIP_SYNC === "true",
  SKIP_VALIDATION: process.env.DEV_SKIP_VALIDATION === "true",
  NODE_ENV: "development",
};

// ============================================================================
// COLORES Y FORMATO
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "") {
  const timestamp = new Date().toTimeString().split(" ")[0];
  console.log(
    `${COLORS.cyan}[${timestamp}]${COLORS.reset} ${color}${message}${COLORS.reset}`,
  );
}

function logSection(title) {
  console.log("");
  console.log(`${COLORS.bright}${COLORS.blue}${"═".repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}  ${title}${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}${"═".repeat(60)}${COLORS.reset}`);
  console.log("");
}

function logSuccess(message) {
  log(`✅ ${message}`, COLORS.green);
}

function logError(message) {
  log(`❌ ${message}`, COLORS.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, COLORS.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, COLORS.blue);
}

// ============================================================================
// PASO 1: VALIDACIÓN DE PERMISOS
// ============================================================================

async function validateProductionPermissions() {
  logSection("PASO 1: VALIDACIÓN DE PERMISOS READ-ONLY");

  if (CONFIG.SKIP_VALIDATION) {
    logWarning("Validación de permisos omitida (DEV_SKIP_VALIDATION=true)");
    return true;
  }

  if (!CONFIG.PROD_URI) {
    logWarning("MONGO_URI_PROD_READ no configurada. Omitiendo validación.");
    return true;
  }

  logInfo("Conectando a producción para validar permisos...");

  try {
    // Importar dinámicamente para evitar errores si no existe
    const { validateProdReadOnlyPermissions } =
      await import("../config/validateProdReadOnlyPermissions.js");

    const connection = await mongoose
      .createConnection(CONFIG.PROD_URI, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 1,
        readPreference: "secondaryPreferred",
      })
      .asPromise();

    try {
      const result = await validateProdReadOnlyPermissions(connection, {
        strictMode: true,
        exitOnFail: false,
      });

      if (result.isValid) {
        logSuccess("Conexión de producción validada como READ-ONLY");
        return true;
      } else {
        logError("La conexión de producción tiene permisos de escritura");
        logError("Por seguridad, el servidor no puede iniciarse.");
        return false;
      }
    } finally {
      await connection.close();
    }
  } catch (error) {
    if (error.message.includes("Validación de permisos read-only fallida")) {
      logError("Validación de permisos fallida");
      return false;
    }

    logWarning(`No se pudo validar permisos: ${error.message}`);
    logWarning("Continuando sin validación de producción...");
    return true;
  }
}

// ============================================================================
// PASO 2: SINCRONIZACIÓN V2
// ============================================================================

async function runSyncV2() {
  logSection("PASO 2: SINCRONIZACIÓN V2 (TIMESTAMPS)");

  if (CONFIG.SKIP_SYNC) {
    logWarning("Sincronización omitida (DEV_SKIP_SYNC=true)");
    return true;
  }

  if (!CONFIG.PROD_URI) {
    logWarning("MONGO_URI_PROD_READ no configurada. Omitiendo sincronización.");
    return true;
  }

  return new Promise((resolve) => {
    const syncScript = path.join(__dirname, "syncProdToLocalV2.js");

    logInfo(`Ejecutando sincronización: ${syncScript}`);

    const syncProcess = fork(syncScript, [], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        NODE_ENV: CONFIG.NODE_ENV,
        SYNC_SKIP_VALIDATION: "true", // Ya validamos en paso 1
      },
      stdio: "inherit",
    });

    syncProcess.on("exit", (code) => {
      if (code === 0) {
        logSuccess("Sincronización V2 completada");
        resolve(true);
      } else {
        logWarning(`Sincronización terminó con código ${code}`);
        logWarning(
          "El servidor se iniciará de todos modos con datos locales existentes",
        );
        resolve(true); // Continuar aunque falle la sincronización
      }
    });

    syncProcess.on("error", (error) => {
      logWarning(`Error en sincronización: ${error.message}`);
      logWarning("El servidor se iniciará con datos locales existentes");
      resolve(true);
    });
  });
}

// ============================================================================
// PASO 3: INICIAR SERVIDOR
// ============================================================================

function startServer() {
  logSection("PASO 3: INICIANDO SERVIDOR");

  const serverPath = path.join(SERVER_DIR, "server.js");

  logInfo(`Iniciando servidor: ${serverPath}`);
  logInfo(`Base de datos: ${CONFIG.LOCAL_URI}`);

  const serverProcess = spawn("node", [serverPath], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: CONFIG.NODE_ENV,
      MONGODB_URI: CONFIG.LOCAL_URI,
      MONGO_URI_DEV_LOCAL: CONFIG.LOCAL_URI,
    },
    stdio: "inherit",
  });

  serverProcess.on("error", (error) => {
    logError(`Error iniciando servidor: ${error.message}`);
    process.exit(1);
  });

  serverProcess.on("exit", (code, signal) => {
    if (signal) {
      logInfo(`Servidor terminado por señal: ${signal}`);
    } else if (code !== 0) {
      logError(`Servidor terminó con código: ${code}`);
    }
    process.exit(code || 0);
  });

  // Manejar señales para terminar limpiamente
  const cleanup = () => {
    logInfo("Deteniendo servidor...");
    serverProcess.kill("SIGTERM");
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  return serverProcess;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  console.log("");
  console.log(
    `${COLORS.bright}${COLORS.magenta}╔════════════════════════════════════════════════════════════╗${COLORS.reset}`,
  );
  console.log(
    `${COLORS.bright}${COLORS.magenta}║           🚀 PIPELINE V2 - DESARROLLO SEGURO 🚀            ║${COLORS.reset}`,
  );
  console.log(
    `${COLORS.bright}${COLORS.magenta}╚════════════════════════════════════════════════════════════╝${COLORS.reset}`,
  );
  console.log("");

  logInfo(`Directorio de trabajo: ${SERVER_DIR}`);
  logInfo(`Entorno: ${CONFIG.NODE_ENV}`);

  // Paso 1: Validar permisos
  const validationPassed = await validateProductionPermissions();
  if (!validationPassed) {
    logError("═══════════════════════════════════════════════════════════");
    logError("ERROR CRÍTICO: PERMISOS DE ESCRITURA DETECTADOS EN PRODUCCIÓN");
    logError("═══════════════════════════════════════════════════════════");
    logError("");
    logError("Por seguridad, el servidor NO puede iniciarse.");
    logError("");
    logError("Acciones requeridas:");
    logError("  1. Crea un usuario MongoDB con SOLO permisos de lectura");
    logError("  2. Actualiza MONGO_URI_PROD_READ con el nuevo usuario");
    logError('  3. Ejecuta "npm run dev:v2" nuevamente');
    logError("");
    process.exit(1);
  }

  // Paso 2: Sincronización V2
  await runSyncV2();

  // Paso 3: Iniciar servidor
  startServer();
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

main().catch((error) => {
  logError(`Error fatal: ${error.message}`);
  console.error(error);
  process.exit(1);
});
