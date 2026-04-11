import dotenv from "dotenv";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
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
import DistributorStats from "../src/infrastructure/database/models/DistributorStats.js";
import DistributorStock from "../src/infrastructure/database/models/DistributorStock.js";
import Expense from "../src/infrastructure/database/models/Expense.js";
import GamificationConfig from "../src/infrastructure/database/models/GamificationConfig.js";
import InventoryEntry from "../src/infrastructure/database/models/InventoryEntry.js";
import IssueReport from "../src/infrastructure/database/models/IssueReport.js";
import Membership from "../src/infrastructure/database/models/Membership.js";
import Notification from "../src/infrastructure/database/models/Notification.js";
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

/**
 * Crear backup local completo en JSON (sin mongodump)
 * VENTAJA: No requiere herramientas externas, más rápido
 */
export const createBackup = async () => {
  try {
    // Directorio de backups en la raíz del proyecto
    const backupDir = path.join(process.cwd(), "..", "backups");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0]; // Solo fecha: 2026-01-06
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    // Crear directorio de backups si no existe
    await fs.mkdir(backupPath, { recursive: true });

    console.log(`📦 Creando backup local en: ${backupPath}`);

    // Conectar a MongoDB si no está conectado
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
      await mongoose.connect(mongoUri);
    }

    // Colecciones a respaldar
    const collections = [
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
    ];

    let totalDocuments = 0;
    let totalCollections = 0;

    for (const { model, name } of collections) {
      try {
        const documents = await model.find({}).lean();

        if (documents.length > 0) {
          const filePath = path.join(backupPath, `${name}.json`);
          await fs.writeFile(filePath, JSON.stringify(documents, null, 2));
          console.log(`   ✅ ${name}: ${documents.length} documentos`);
          totalDocuments += documents.length;
          totalCollections++;
        } else {
          console.log(`   ⚪ ${name}: vacía`);
        }
      } catch (error) {
        console.log(`   ❌ ${name}: Error - ${error.message}`);
      }
    }

    // Crear metadata del backup
    const metadata = {
      timestamp: new Date().toISOString(),
      totalCollections,
      totalDocuments,
      environment: process.env.NODE_ENV || "development",
      mongoUri: (process.env.MONGO_URI || process.env.MONGODB_URI).replace(
        /\/\/[^:]+:[^@]+@/,
        "//*****:*****@"
      ), // Ocultar credenciales
    };

    await fs.writeFile(
      path.join(backupPath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`\n✅ Backup creado exitosamente`);
    console.log(`   📂 Ubicación: ${backupPath}`);
    console.log(
      `   📊 ${totalCollections} colecciones, ${totalDocuments} documentos\n`
    );

    // Limpiar backups antiguos
    await cleanOldBackups(backupDir, 30); // Mantener 30 días

    return backupPath;
  } catch (error) {
    console.error("❌ Error creando backup:", error.message);
    throw error;
  }
};

/**
 * Limpiar backups antiguos
 */
const cleanOldBackups = async (backupDir, daysToKeep) => {
  try {
    const files = await fs.readdir(backupDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    let cleaned = 0;

    for (const file of files) {
      if (!file.startsWith("backup-")) continue;

      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.rm(filePath, { recursive: true, force: true });
        console.log(`   🗑️  Backup antiguo eliminado: ${file}`);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`   ✅ ${cleaned} backup(s) antiguos eliminados\n`);
    }
  } catch (error) {
    console.error("⚠️  Error limpiando backups antiguos:", error.message);
  }
};

/**
 * Restaurar desde backup local
 */
export const restoreBackup = async (backupPath) => {
  try {
    console.log(`📥 Restaurando backup desde: ${backupPath}\n`);

    // Conectar a MongoDB si no está conectado
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
      await mongoose.connect(mongoUri);
    }

    // Leer metadata
    const metadataPath = path.join(backupPath, "metadata.json");
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

    console.log(
      `📋 Backup creado: ${new Date(metadata.timestamp).toLocaleString(
        "es-ES"
      )}`
    );
    console.log(
      `📊 ${metadata.totalCollections} colecciones, ${metadata.totalDocuments} documentos\n`
    );

    // Leer archivos JSON
    const files = await fs.readdir(backupPath);
    const jsonFiles = files.filter(
      (f) => f.endsWith(".json") && f !== "metadata.json"
    );

    let totalRestored = 0;

    for (const file of jsonFiles) {
      const collectionName = file.replace(".json", "");
      const filePath = path.join(backupPath, file);

      try {
        const data = JSON.parse(await fs.readFile(filePath, "utf8"));

        if (data.length > 0) {
          // Obtener el modelo correspondiente
          const modelMap = {
            users: User,
            businesses: Business,
            memberships: Membership,
            products: Product,
            categories: Category,
            sales: Sale,
            specialsales: SpecialSale,
            customers: Customer,
            credits: Credit,
            creditpayments: CreditPayment,
            stock: Stock,
            stocktransfers: StockTransfer,
            distributorstock: DistributorStock,
            distributorstats: DistributorStats,
            providers: Provider,
            promotions: Promotion,
            branches: Branch,
            branchstock: BranchStock,
            branchtransfers: BranchTransfer,
            expenses: Expense,
            inventoryentries: InventoryEntry,
            defectiveproducts: DefectiveProduct,
            segments: Segment,
            notifications: Notification,
            issuereports: IssueReport,
            profithistory: ProfitHistory,
            periodwinners: PeriodWinner,
            gamificationconfigs: GamificationConfig,
            businessassistantconfigs: BusinessAssistantConfig,
            auditlogs: AuditLog,
            refreshtokens: RefreshToken,
          };

          const Model = modelMap[collectionName];

          if (Model) {
            // Borrar colección existente
            await Model.deleteMany({});

            // Insertar datos del backup
            await Model.insertMany(data);

            console.log(
              `   ✅ ${collectionName}: ${data.length} documentos restaurados`
            );
            totalRestored += data.length;
          }
        }
      } catch (error) {
        console.log(`   ❌ ${collectionName}: Error - ${error.message}`);
      }
    }

    console.log(`\n✅ Restauración completada: ${totalRestored} documentos\n`);

    return true;
  } catch (error) {
    console.error("❌ Error restaurando backup:", error.message);
    throw error;
  }
};
