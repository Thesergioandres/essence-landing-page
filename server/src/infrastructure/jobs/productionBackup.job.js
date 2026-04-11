import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { enforceReadOnlyForProtectedProductionUri } from "../../../security/mongooseWriteProtector.js";
import { resolveProductionMongoSource } from "../database/utils/resolveProductionMongoUri.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.join(__dirname, "../../..");

dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

const BACKUP_INTERVAL_HOURS = 8;
const BACKUP_RETENTION_DAYS = 15;
const BACKUP_DIR = path.join(SERVER_ROOT, "..", "backups");
const BACKUP_PREFIX = "prod-mirror-backup-";

let workerRunning = false;
let backupInterval = null;
let initialRunTimer = null;
let backupInProgress = false;
let lastBackupStatus = null;

const maskMongoUri = (uri = "") =>
  uri.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@");

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

const buildBackupFileName = () => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  return `${BACKUP_PREFIX}${timestamp}.json.gz`;
};

const cleanupOldBackups = () => {
  const cutoffMs =
    Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter(
      (file) => file.startsWith(BACKUP_PREFIX) && file.endsWith(".json.gz"),
    );

  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < cutoffMs) {
      fs.unlinkSync(filePath);
      deletedCount += 1;
      console.log(`[PROD BACKUP] Deleted old backup: ${file}`);
    }
  }

  return deletedCount;
};

const readCollectionsSnapshot = async (connection) => {
  const collections = await connection.db.listCollections().toArray();

  const snapshot = {};
  let totalDocuments = 0;

  for (const collectionMeta of collections) {
    const collectionName = collectionMeta?.name;
    if (!collectionName || collectionName.startsWith("system.")) {
      continue;
    }

    const documents = await connection.db
      .collection(collectionName)
      .find({})
      .toArray();

    snapshot[collectionName] = documents;
    totalDocuments += documents.length;
  }

  return {
    collections: snapshot,
    totalCollections: Object.keys(snapshot).length,
    totalDocuments,
  };
};

export const runProductionBackupOnce = async () => {
  if (backupInProgress) {
    console.log("[PROD BACKUP] Backup already running, skipping trigger.");
    return null;
  }

  backupInProgress = true;
  const startedAt = Date.now();

  try {
    ensureBackupDir();

    const source = resolveProductionMongoSource(process.env);
    if (Array.isArray(source.warnings)) {
      source.warnings.forEach((warning) =>
        console.warn(`[PROD BACKUP] ${warning}`),
      );
    }

    if (!source.uri) {
      throw new Error(
        "No production URI available for production backup (MONGO_URI_PROD / MONGO_PUBLIC_URL / RAILWAY_TCP_PROXY_*).",
      );
    }

    const connection = await mongoose
      .createConnection(source.uri, {
        serverSelectionTimeoutMS: 20000,
        socketTimeoutMS: 120000,
        maxPoolSize: 2,
        readPreference: "secondaryPreferred",
      })
      .asPromise();

    try {
      enforceReadOnlyForProtectedProductionUri(connection, source.uri, {
        nodeEnv: process.env.NODE_ENV || "development",
      });

      const snapshot = await readCollectionsSnapshot(connection);

      const payload = {
        metadata: {
          createdAt: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
          source: source.source,
          sourceUri: maskMongoUri(source.uri),
          totalCollections: snapshot.totalCollections,
          totalDocuments: snapshot.totalDocuments,
          durationMs: Date.now() - startedAt,
          compression: "gzip",
        },
        collections: snapshot.collections,
      };

      const json = JSON.stringify(payload);
      const compressed = zlib.gzipSync(Buffer.from(json, "utf8"), {
        level: 9,
      });

      const backupFileName = buildBackupFileName();
      const backupFilePath = path.join(BACKUP_DIR, backupFileName);

      fs.writeFileSync(backupFilePath, compressed);
      const deleted = cleanupOldBackups();

      lastBackupStatus = {
        success: true,
        path: backupFilePath,
        sizeBytes: compressed.length,
        totalCollections: snapshot.totalCollections,
        totalDocuments: snapshot.totalDocuments,
        deletedOldBackups: deleted,
        createdAt: new Date().toISOString(),
      };

      console.log(
        `[PROD BACKUP] Completed: ${snapshot.totalCollections} collections, ${snapshot.totalDocuments} docs, ${compressed.length} bytes.`,
      );

      return backupFilePath;
    } finally {
      await connection.close();
    }
  } catch (error) {
    lastBackupStatus = {
      success: false,
      error: error.message,
      createdAt: new Date().toISOString(),
    };

    console.error("[PROD BACKUP] Failed:", error.message);
    return null;
  } finally {
    backupInProgress = false;
  }
};

const getNextRunEta = () => {
  const next = new Date(Date.now() + BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
  return next.toISOString();
};

export const startProductionBackupWorker = () => {
  if (workerRunning) {
    console.log("[PROD BACKUP] Worker already running.");
    return;
  }

  if (process.env.NODE_ENV === "test") {
    console.log("[PROD BACKUP] Worker disabled in test environment.");
    return;
  }

  if (process.env.PRODUCTION_BACKUP_WORKER_DISABLED === "true") {
    console.log("[PROD BACKUP] Worker disabled by PRODUCTION_BACKUP_WORKER_DISABLED=true.");
    return;
  }

  workerRunning = true;
  console.log("[PROD BACKUP] Worker started.");
  console.log(`[PROD BACKUP] Interval: every ${BACKUP_INTERVAL_HOURS} hours.`);
  console.log(`[PROD BACKUP] Retention: ${BACKUP_RETENTION_DAYS} days.`);
  console.log(`[PROD BACKUP] Directory: ${BACKUP_DIR}`);

  initialRunTimer = setTimeout(async () => {
    await runProductionBackupOnce();
  }, 30 * 1000);

  const intervalMs = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
  backupInterval = setInterval(async () => {
    await runProductionBackupOnce();
  }, intervalMs);

  console.log(`[PROD BACKUP] Next run ETA: ${getNextRunEta()}`);
};

export const stopProductionBackupWorker = () => {
  if (initialRunTimer) {
    clearTimeout(initialRunTimer);
    initialRunTimer = null;
  }

  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }

  workerRunning = false;
  console.log("[PROD BACKUP] Worker stopped.");
};

export const getProductionBackupWorkerStatus = () => ({
  workerRunning,
  backupInProgress,
  lastBackupStatus,
  intervalHours: BACKUP_INTERVAL_HOURS,
  retentionDays: BACKUP_RETENTION_DAYS,
  backupDir: BACKUP_DIR,
  nextRunEta: workerRunning ? getNextRunEta() : null,
});

export default {
  startProductionBackupWorker,
  stopProductionBackupWorker,
  getProductionBackupWorkerStatus,
  runProductionBackupOnce,
};
