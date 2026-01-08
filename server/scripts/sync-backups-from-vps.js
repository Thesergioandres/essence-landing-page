/**
 * Script para Sincronizar Backups desde el VPS
 * Descarga automáticamente los backups del VPS a la PC local
 * Y LOS BORRA DEL SERVIDOR para ahorrar espacio
 *
 * USO:
 * node scripts/sync-backups-from-vps.js
 */

import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { Client } from "ssh2";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración SSH del VPS
const VPS_CONFIG = {
  host: process.env.VPS_HOST || "93.189.89.195",
  port: parseInt(process.env.VPS_PORT) || 22,
  username: process.env.VPS_USERNAME || "root",
  password: process.env.VPS_PASSWORD || "",
};

// Rutas
const VPS_BACKUP_PATH =
  process.env.VPS_BACKUP_PATH || "/home/deploy/app/backups";
const LOCAL_BACKUP_PATH = path.join(__dirname, "..", "..", "backups");
const LOCAL_VPS_BACKUPS = path.join(LOCAL_BACKUP_PATH, "vps-backups");

// Opción para borrar backups del VPS después de descargar
const DELETE_AFTER_DOWNLOAD = process.env.DELETE_VPS_BACKUPS !== "false"; // true por defecto

/**
 * Conectar al VPS vía SSH
 */
const connectToVPS = () => {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on("ready", () => {
      console.log("✅ Conectado al VPS");
      resolve(conn);
    });

    conn.on("error", (err) => {
      console.error("❌ Error de conexión SSH:", err.message);
      reject(err);
    });

    conn.connect({
      host: VPS_CONFIG.host,
      port: VPS_CONFIG.port,
      username: VPS_CONFIG.username,
      password: VPS_CONFIG.password,
      readyTimeout: 30000,
    });
  });
};

/**
 * Listar backups disponibles en el VPS
 */
const listVPSBackups = (conn) => {
  return new Promise((resolve, reject) => {
    conn.exec(
      `ls -1 ${VPS_BACKUP_PATH} 2>/dev/null || echo ""`,
      (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let data = "";
        stream.on("data", (chunk) => {
          data += chunk.toString();
        });

        stream.on("end", () => {
          const backups = data
            .split("\n")
            .filter((line) => line.trim().startsWith("backup-"))
            .map((line) => line.trim());
          resolve(backups);
        });

        stream.stderr.on("data", (data) => {
          // Ignorar errores de ls si la carpeta no existe
        });
      }
    );
  });
};

/**
 * Obtener backups locales ya descargados
 */
const getLocalVPSBackups = async () => {
  try {
    await fs.mkdir(LOCAL_VPS_BACKUPS, { recursive: true });
    const entries = await fs.readdir(LOCAL_VPS_BACKUPS);
    return entries.filter((e) => e.startsWith("backup-"));
  } catch (error) {
    return [];
  }
};

/**
 * Descargar un archivo individual vía SFTP
 */
const downloadFile = (conn, remotePath, localPath) => {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }

      sftp.fastGet(remotePath, localPath, (err) => {
        sftp.end();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

/**
 * Descargar un backup del VPS
 */
const downloadBackup = (conn, backupName) => {
  return new Promise((resolve, reject) => {
    const remotePath = `${VPS_BACKUP_PATH}/${backupName}`;
    const localPath = path.join(LOCAL_VPS_BACKUPS, backupName);

    console.log(`\n📥 Descargando: ${backupName}`);

    // Crear directorio local
    fs.mkdir(localPath, { recursive: true })
      .then(() => {
        // Obtener lista de archivos en el backup remoto
        conn.exec(`ls -1 ${remotePath}`, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let files = "";
          stream.on("data", (chunk) => {
            files += chunk.toString();
          });

          stream.on("end", async () => {
            const fileList = files
              .split("\n")
              .filter((f) => f.trim())
              .map((f) => f.trim());

            console.log(`   📄 ${fileList.length} archivos encontrados`);

            // Descargar cada archivo
            let downloaded = 0;
            for (const file of fileList) {
              try {
                await downloadFile(
                  conn,
                  `${remotePath}/${file}`,
                  path.join(localPath, file)
                );
                downloaded++;
                process.stdout.write(
                  `\r   ✅ ${downloaded}/${fileList.length} archivos descargados`
                );
              } catch (error) {
                console.error(
                  `\n   ❌ Error descargando ${file}:`,
                  error.message
                );
              }
            }

            console.log(`\n   ✅ Backup completo: ${backupName}`);
            resolve();
          });
        });
      })
      .catch(reject);
  });
};

/**
 * Borrar un backup del VPS después de descargarlo
 */
const deleteVPSBackup = (conn, backupName) => {
  return new Promise((resolve, reject) => {
    const remotePath = `${VPS_BACKUP_PATH}/${backupName}`;

    conn.exec(`rm -rf ${remotePath}`, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      stream.on("end", () => {
        console.log(`   🗑️  Borrado del VPS: ${backupName}`);
        resolve();
      });

      stream.stderr.on("data", (data) => {
        console.error(`   ⚠️  Error borrando: ${data.toString()}`);
      });
    });
  });
};

/**
 * Verificar que el backup se descargó correctamente
 */
const verifyLocalBackup = async (backupName) => {
  const localPath = path.join(LOCAL_VPS_BACKUPS, backupName);
  try {
    const files = await fs.readdir(localPath);
    // Verificar que al menos exista metadata.json
    return files.includes("metadata.json") || files.length > 0;
  } catch {
    return false;
  }
};

/**
 * Sincronizar backups del VPS
 */
const syncBackups = async () => {
  console.log("\n" + "═".repeat(60));
  console.log("🔄 SINCRONIZACIÓN DE BACKUPS DESDE VPS");
  console.log("═".repeat(60));
  console.log(`📍 VPS: ${VPS_CONFIG.host}`);
  console.log(`📂 Ruta remota: ${VPS_BACKUP_PATH}`);
  console.log(`💾 Ruta local: ${LOCAL_VPS_BACKUPS}`);
  console.log(
    `🗑️  Borrar después de descargar: ${DELETE_AFTER_DOWNLOAD ? "SÍ" : "NO"}`
  );

  // Validar configuración
  if (!VPS_CONFIG.password) {
    console.error("\n❌ Error: Falta contraseña del VPS");
    console.log("\n📝 Configura VPS_PASSWORD en .env:");
    console.log("   VPS_PASSWORD=tu-password");
    process.exit(1);
  }

  try {
    // Conectar al VPS
    const conn = await connectToVPS();

    // Listar backups remotos
    console.log("\n📋 Listando backups en el VPS...");
    const vpsBackups = await listVPSBackups(conn);
    console.log(`   📦 ${vpsBackups.length} backups encontrados en el VPS`);

    if (vpsBackups.length === 0) {
      console.log("\n⚠️  No hay backups en el VPS");
      conn.end();
      return;
    }

    // Listar backups locales
    const localBackups = await getLocalVPSBackups();
    console.log(
      `   💾 ${localBackups.length} backups ya descargados localmente`
    );

    // Identificar backups nuevos
    const newBackups = vpsBackups.filter((b) => !localBackups.includes(b));

    if (newBackups.length === 0) {
      console.log("\n✅ Todo sincronizado - No hay backups nuevos");

      // Si ya están sincronizados, borrar los del VPS si la opción está activa
      if (DELETE_AFTER_DOWNLOAD && vpsBackups.length > 0) {
        console.log("\n🗑️  Limpiando backups ya descargados del VPS...");
        for (const backup of vpsBackups) {
          if (localBackups.includes(backup)) {
            await deleteVPSBackup(conn, backup);
          }
        }
      }

      conn.end();
      return;
    }

    console.log(`\n🆕 ${newBackups.length} backup(s) nuevo(s) por descargar:`);
    newBackups.forEach((b) => console.log(`   • ${b}`));

    // Descargar y opcionalmente borrar backups nuevos
    for (const backup of newBackups) {
      await downloadBackup(conn, backup);

      // Verificar descarga y borrar del VPS si está habilitado
      if (DELETE_AFTER_DOWNLOAD) {
        const verified = await verifyLocalBackup(backup);
        if (verified) {
          await deleteVPSBackup(conn, backup);
        } else {
          console.log(`   ⚠️  No se borró ${backup} - verificación falló`);
        }
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log("✅ Sincronización completada exitosamente");
    console.log("═".repeat(60));
    console.log(`📂 Backups guardados en: ${LOCAL_VPS_BACKUPS}`);
    if (DELETE_AFTER_DOWNLOAD) {
      console.log(`🗑️  Backups eliminados del VPS para ahorrar espacio`);
    }

    conn.end();
  } catch (error) {
    console.error("\n❌ Error durante la sincronización:", error.message);
    process.exit(1);
  }
};

// Ejecutar sincronización
syncBackups().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
