/**
 * Worker de Backup Automático
 * Ejecuta backups cada 6 horas y mantiene los últimos 30 días
 */

import dotenv from "dotenv";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";

// Importar modelos necesarios para backup
import AuditLog from "../src/infrastructure/database/models/AuditLog.js";
import Branch from "../src/infrastructure/database/models/Branch.js";
import BranchStock from "../src/infrastructure/database/models/BranchStock.js";
import BranchTransfer from "../src/infrastructure/database/models/BranchTransfer.js";
import Business from "../src/infrastructure/database/models/Business.js";
import BusinessAssistantConfig from "../src/infrastructure/database/models/BusinessAssistantConfig.js";
import Category from "../src/infrastructure/database/models/Category.js";
import Credit from "../src/infrastructure/database/models/Credit.js";
import CreditPayment from "../src/infrastructure/database/models/CreditPayment.js";
import Customer from "../src/infrastructure/database/models/Customer.js";
import DefectiveProduct from "../src/infrastructure/database/models/DefectiveProduct.js";
import DeliveryMethod from "../src/infrastructure/database/models/DeliveryMethod.js";
import DistributorStats from "../src/infrastructure/database/models/DistributorStats.js";
import DistributorStock from "../src/infrastructure/database/models/DistributorStock.js";
import Expense from "../src/infrastructure/database/models/Expense.js";
import GamificationConfig from "../src/infrastructure/database/models/GamificationConfig.js";
import InventoryEntry from "../src/infrastructure/database/models/InventoryEntry.js";
import IssueReport from "../src/infrastructure/database/models/IssueReport.js";
import Membership from "../src/infrastructure/database/models/Membership.js";
import Notification from "../src/infrastructure/database/models/Notification.js";
import PaymentMethod from "../src/infrastructure/database/models/PaymentMethod.js";
import PeriodWinner from "../src/infrastructure/database/models/PeriodWinner.js";
import Product from "../src/infrastructure/database/models/Product.js";
import ProfitHistory from "../src/infrastructure/database/models/ProfitHistory.js";
import Promotion from "../src/infrastructure/database/models/Promotion.js";
import Provider from "../src/infrastructure/database/models/Provider.js";
import RefreshToken from "../src/infrastructure/database/models/RefreshToken.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import Segment from "../src/infrastructure/database/models/Segment.js";
import SpecialSale from "../src/infrastructure/database/models/SpecialSale.js";
import Stock from "../src/infrastructure/database/models/Stock.js";
import StockTransfer from "../src/infrastructure/database/models/StockTransfer.js";
import User from "../src/infrastructure/database/models/User.js";

dotenv.config();

// Configuración
const BACKUP_INTERVAL_HOURS = 6; // Cada 6 horas
const BACKUP_RETENTION_DAYS = 30; // Mantener 30 días
const BACKUP_DIR = path.join(process.cwd(), "..", "backups");

// Estado del worker
let backupInterval = null;
let isRunning = false;
let lastBackupTime = null;
let lastBackupStatus = null;

/**
 * Colecciones a respaldar
 */
const getCollections = () => [
  { model: User, name: "users" },
  { model: Business, name: "businesses" },
  { model: Membership, name: "memberships" },
  { model: Product, name: "products" },
  { model: Category, name: "categories" },
  { model: Sale, name: "sales" },
  { model: SpecialSale, name: "specialsales" },
  { model: Customer, name: "customers" },
  { model: Credit, name: "credits" },
  { model: CreditPayment, name: "creditpayments" },
  { model: Stock, name: "stock" },
  { model: StockTransfer, name: "stocktransfers" },
  { model: DistributorStock, name: "distributorstock" },
  { model: DistributorStats, name: "distributorstats" },
  { model: Provider, name: "providers" },
  { model: Promotion, name: "promotions" },
  { model: Branch, name: "branches" },
  { model: BranchStock, name: "branchstock" },
  { model: BranchTransfer, name: "branchtransfers" },
  { model: Expense, name: "expenses" },
  { model: InventoryEntry, name: "inventoryentries" },
  { model: DefectiveProduct, name: "defectiveproducts" },
  { model: Segment, name: "segments" },
  { model: Notification, name: "notifications" },
  { model: IssueReport, name: "issuereports" },
  { model: ProfitHistory, name: "profithistory" },
  { model: PeriodWinner, name: "periodwinners" },
  { model: GamificationConfig, name: "gamificationconfigs" },
  { model: BusinessAssistantConfig, name: "businessassistantconfigs" },
  { model: AuditLog, name: "auditlogs" },
  { model: RefreshToken, name: "refreshtokens" },
  { model: PaymentMethod, name: "paymentmethods" },
  { model: DeliveryMethod, name: "deliverymethods" },
];

/**
 * Crear backup automático
 */
const createAutomaticBackup = async () => {
  const startTime = Date.now();

  try {
    console.log("\n" + "═".repeat(60));
    console.log("🔄 [BACKUP AUTOMÁTICO] Iniciando backup...");
    console.log("═".repeat(60));

    // Timestamp con hora para backups cada 6 horas
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16); // 2026-01-08T02-00
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

    // Crear directorio de backup
    await fs.mkdir(backupPath, { recursive: true });

    // Verificar conexión a MongoDB
    if (mongoose.connection.readyState !== 1) {
      console.log("⚠️  MongoDB no conectado, saltando backup");
      return null;
    }

    const collections = getCollections();
    let totalDocuments = 0;
    let totalCollections = 0;
    let errors = [];

    console.log(`📂 Destino: ${backupPath}`);
    console.log(`📦 Respaldando ${collections.length} colecciones...\n`);

    for (const { model, name } of collections) {
      try {
        const documents = await model.find({}).lean();

        if (documents.length > 0) {
          const filePath = path.join(backupPath, `${name}.json`);
          await fs.writeFile(filePath, JSON.stringify(documents, null, 2));
          console.log(`   ✅ ${name}: ${documents.length} docs`);
          totalDocuments += documents.length;
          totalCollections++;
        }
      } catch (error) {
        console.log(`   ❌ ${name}: ${error.message}`);
        errors.push({ collection: name, error: error.message });
      }
    }

    // Crear metadata del backup
    const metadata = {
      timestamp: now.toISOString(),
      type: "automatic",
      intervalHours: BACKUP_INTERVAL_HOURS,
      totalCollections,
      totalDocuments,
      errors: errors.length > 0 ? errors : undefined,
      environment: process.env.NODE_ENV || "development",
      durationMs: Date.now() - startTime,
      dbName: mongoose.connection.name,
    };

    await fs.writeFile(
      path.join(backupPath, "metadata.json"),
      JSON.stringify(metadata, null, 2),
    );

    // Limpiar backups antiguos
    await cleanOldBackups();

    // Actualizar estado
    lastBackupTime = now;
    lastBackupStatus = {
      success: true,
      path: backupPath,
      collections: totalCollections,
      documents: totalDocuments,
      duration: Date.now() - startTime,
    };

    console.log("\n" + "─".repeat(60));
    console.log(`✅ [BACKUP COMPLETADO]`);
    console.log(
      `   📊 ${totalCollections} colecciones, ${totalDocuments} documentos`,
    );
    console.log(`   ⏱️  Duración: ${Date.now() - startTime}ms`);
    console.log(`   🕐 Próximo backup: ${getNextBackupTime()}`);
    console.log("─".repeat(60) + "\n");

    return backupPath;
  } catch (error) {
    console.error("❌ [BACKUP ERROR]", error.message);
    lastBackupStatus = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    return null;
  }
};

/**
 * Limpiar backups antiguos (más de 30 días)
 */
const cleanOldBackups = async () => {
  try {
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    const backupFolders = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
      .map((e) => e.name);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    let deleted = 0;

    for (const folder of backupFolders) {
      try {
        // Extraer fecha del nombre del folder (backup-2026-01-08T02-00)
        const dateStr = folder.replace("backup-", "").slice(0, 10);
        const folderDate = new Date(dateStr);

        if (folderDate < cutoffDate) {
          const folderPath = path.join(BACKUP_DIR, folder);
          await fs.rm(folderPath, { recursive: true, force: true });
          console.log(`   🗑️  Eliminado backup antiguo: ${folder}`);
          deleted++;
        }
      } catch (err) {
        // Ignorar errores de parsing de fecha
      }
    }

    if (deleted > 0) {
      console.log(`   📋 ${deleted} backup(s) antiguo(s) eliminado(s)`);
    }
  } catch (error) {
    console.error("⚠️  Error limpiando backups antiguos:", error.message);
  }
};

/**
 * Calcular próximo tiempo de backup
 */
const getNextBackupTime = () => {
  const next = new Date();
  next.setHours(next.getHours() + BACKUP_INTERVAL_HOURS);
  return next.toLocaleString("es-CO");
};

/**
 * Iniciar worker de backup automático
 */
export const startBackupWorker = () => {
  if (isRunning) {
    console.log("⚠️  Backup worker ya está corriendo");
    return;
  }

  // No ejecutar en entorno de test
  if (process.env.NODE_ENV === "test") {
    console.log("🧪 Backup worker deshabilitado en modo test");
    return;
  }

  console.log("\n" + "═".repeat(60));
  console.log("🚀 [BACKUP WORKER] Iniciando sistema de backups automáticos");
  console.log("═".repeat(60));
  console.log(`   ⏰ Intervalo: cada ${BACKUP_INTERVAL_HOURS} horas`);
  console.log(`   📅 Retención: últimos ${BACKUP_RETENTION_DAYS} días`);
  console.log(`   📂 Directorio: ${BACKUP_DIR}`);
  console.log("═".repeat(60) + "\n");

  isRunning = true;

  // Ejecutar primer backup después de 1 minuto (dar tiempo a que MongoDB conecte)
  setTimeout(async () => {
    console.log("🔄 [BACKUP WORKER] Ejecutando backup inicial...");
    await createAutomaticBackup();
  }, 60 * 1000); // 1 minuto

  // Configurar intervalo para backups cada 6 horas
  const intervalMs = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
  backupInterval = setInterval(async () => {
    await createAutomaticBackup();
  }, intervalMs);

  console.log(`✅ [BACKUP WORKER] Activo - Próximo backup en 1 minuto`);
};

/**
 * Detener worker de backup
 */
export const stopBackupWorker = () => {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
  isRunning = false;
  console.log("🛑 [BACKUP WORKER] Detenido");
};

/**
 * Obtener estado del worker
 */
export const getBackupWorkerStatus = () => ({
  isRunning,
  lastBackupTime,
  lastBackupStatus,
  nextBackupTime: isRunning ? getNextBackupTime() : null,
  intervalHours: BACKUP_INTERVAL_HOURS,
  retentionDays: BACKUP_RETENTION_DAYS,
  backupDir: BACKUP_DIR,
});

/**
 * Ejecutar backup manual (para API)
 */
export const triggerManualBackup = async () => {
  console.log("📦 [BACKUP MANUAL] Solicitado por usuario");
  return await createAutomaticBackup();
};

export default {
  startBackupWorker,
  stopBackupWorker,
  getBackupWorkerStatus,
  triggerManualBackup,
};
