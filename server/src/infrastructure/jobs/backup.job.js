import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createBackup } from "../../../utils/backup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../..", ".env") });

/**
 * Script manual para crear backup
 * Uso: node scripts/backup-database.js
 */
const main = async () => {
  console.log("═══════════════════════════════════════════════════");
  console.log("📦 BACKUP MANUAL DE BASE DE DATOS");
  console.log("═══════════════════════════════════════════════════\n");

  try {
    const backupPath = await createBackup();
    console.log("\n✅ Backup completado exitosamente");
    console.log(`📂 Ubicación: ${backupPath}`);
  } catch (error) {
    console.error("\n❌ Error al crear backup:", error.message);
    console.error("\n💡 Asegúrate de tener mongodump instalado:");
    console.error(
      "   - Windows: https://www.mongodb.com/try/download/database-tools",
    );
    console.error("   - Linux/Mac: sudo apt install mongodb-database-tools");
    process.exit(1);
  }
};

main();
