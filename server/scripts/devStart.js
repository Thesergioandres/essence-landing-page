/**
 * 🚀 Script de inicio para desarrollo con sincronización
 *
 * Este script:
 * 1. Sincroniza datos nuevos de producción → local
 * 2. Inicia el servidor usando la BD local
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.join(__dirname, "..");

console.log("\n" + "=".repeat(60));
console.log("🚀 ESSENCE BACKEND - MODO DESARROLLO");
console.log("=".repeat(60) + "\n");

/**
 * Ejecutar un script y esperar a que termine
 */
function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [scriptPath, ...args], {
      cwd: serverDir,
      stdio: "inherit",
      env: process.env,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script terminó con código ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Iniciar el servidor
 */
function startServer() {
  console.log("🌐 Iniciando servidor...\n");

  const server = spawn("node", ["server.js"], {
    cwd: serverDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
  });

  server.on("error", (err) => {
    console.error("❌ Error iniciando servidor:", err.message);
    process.exit(1);
  });

  // Manejar señales de terminación
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Deteniendo servidor...");
    server.kill("SIGINT");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    server.kill("SIGTERM");
    process.exit(0);
  });
}

/**
 * Flujo principal
 */
async function main() {
  try {
    // 1. Sincronizar datos de producción → local
    console.log("📥 Paso 1: Sincronización Producción → Local\n");

    const syncScript = path.join(__dirname, "syncProdToLocal.js");

    try {
      await runScript(syncScript);
    } catch (syncError) {
      console.warn("⚠️  Sincronización falló o fue omitida. Continuando...\n");
    }

    // 2. Iniciar servidor
    console.log("🌐 Paso 2: Iniciando Servidor\n");
    startServer();
  } catch (error) {
    console.error("❌ Error fatal:", error.message);
    process.exit(1);
  }
}

main();
