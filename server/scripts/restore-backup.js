import dotenv from "dotenv";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { restoreBackup } from "../utils/backup.js";

dotenv.config();

/**
 * Script para restaurar backup
 * Uso: node scripts/restore-backup.js [backup-folder-name]
 * Ejemplo: node scripts/restore-backup.js backup-2026-01-06
 */
const main = async () => {
  console.log("═══════════════════════════════════════════════════");
  console.log("📥 RESTAURAR BACKUP");
  console.log("═══════════════════════════════════════════════════\n");

  try {
    const backupDir = path.join(process.cwd(), "..", "backups");

    // Si no se especifica backup, listar disponibles
    if (process.argv.length < 3) {
      console.log("📋 Backups disponibles:\n");
      const files = await fs.readdir(backupDir);
      const backups = files.filter((f) => f.startsWith("backup-"));

      if (backups.length === 0) {
        console.log("   ⚠️  No hay backups disponibles");
        process.exit(0);
      }

      backups.sort().reverse();

      for (let i = 0; i < backups.length; i++) {
        const backupPath = path.join(backupDir, backups[i]);
        const metadataPath = path.join(backupPath, "metadata.json");

        try {
          const stats = await fs.stat(backupPath);
          const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

          console.log(`${i + 1}. ${backups[i]}`);
          console.log(
            `   📅 ${new Date(metadata.timestamp).toLocaleString("es-ES")}`
          );
          console.log(
            `   📊 ${metadata.totalCollections} colecciones, ${metadata.totalDocuments} documentos`
          );
          console.log(`   💾 ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
        } catch (error) {
          console.log(`${i + 1}. ${backups[i]}`);
          console.log(
            `   📅 ${new Date(stats.mtime).toLocaleString("es-ES")}\n`
          );
        }
      }

      console.log("\n💡 Uso: node scripts/restore-backup.js [nombre-backup]");
      console.log(`   Ejemplo: node scripts/restore-backup.js ${backups[0]}`);
      process.exit(0);
    }

    const backupName = process.argv[2];
    const backupPath = path.join(backupDir, backupName);

    // Verificar que existe
    try {
      await fs.access(backupPath);
    } catch (error) {
      console.error(`❌ Backup no encontrado: ${backupName}`);
      process.exit(1);
    }

    // Advertencia
    console.log("⚠️  ADVERTENCIA: Esta operación:");
    console.log("   - Borrará TODOS los datos actuales");
    console.log("   - Restaurará los datos del backup seleccionado");
    console.log(`   - Backup: ${backupName}\n`);

    console.log("💡 Presiona Ctrl+C para cancelar...");
    console.log("   Iniciando en 5 segundos...\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Conectar a MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log("✅ Conectado a MongoDB\n");

    // Restaurar
    await restoreBackup(backupPath);

    console.log("✅ Restauración completada exitosamente\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error al restaurar backup:", error.message);
    process.exit(1);
  }
};

main();
