/**
 * ============================================================================
 * MONGOOSE WRITE PROTECTOR - Protección a Nivel Driver
 * ============================================================================
 *
 * Este módulo implementa protecciones a nivel de driver de Mongoose para
 * prevenir cualquier operación de escritura en la conexión de producción.
 *
 * Funciona interceptando y sobrescribiendo métodos de Mongoose para que
 * lancen errores cuando se intenta escribir en producción.
 *
 * @version 2.0.0
 * @date 2026-01-22
 */

import mongoose from "mongoose";
import { syncLogger } from "../utils/syncLogger.js";

const safeTrim = (value) =>
  typeof value === "string" ? value.trim().replace(/^"|"$/g, "") : "";

const normalizeMongoUri = (uri) => {
  const raw = safeTrim(uri);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    const host = (parsed.hostname || "").toLowerCase();
    const port = parsed.port || "27017";
    const dbName = (parsed.pathname || "").replace(/^\/+/, "") || "admin";

    return `${protocol}//${host}:${port}/${dbName}`;
  } catch {
    return "";
  }
};

const resolveConfiguredProductionUris = (env = process.env) =>
  [
    env.MONGO_URI_PROD,
    env.MONGODB_URI_PROD,
    env.MONGO_URI_PROD_READ,
    env.MONGODB_URI_PROD_READ,
    env.MONGO_PUBLIC_URL,
    env.RAILWAY_MONGO_PUBLIC_URL,
  ]
    .map(safeTrim)
    .filter(Boolean);

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Lista de métodos de escritura que serán interceptados
 */
const WRITE_METHODS = {
  // Métodos de Model
  model: [
    "create",
    "insertMany",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "findByIdAndUpdate",
    "findByIdAndDelete",
    "findByIdAndRemove",
    "replaceOne",
    "bulkWrite",
    "bulkSave",
  ],

  // Métodos de Document
  document: ["save", "remove", "deleteOne", "updateOne"],

  // Métodos de Query
  query: [
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "findOneAndRemove",
    "replaceOne",
  ],

  // Métodos de Collection (driver nativo)
  collection: [
    "insertOne",
    "insertMany",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "replaceOne",
    "bulkWrite",
    "drop",
    "rename",
    "createIndex",
    "dropIndex",
    "dropIndexes",
  ],

  // Métodos de DB
  db: [
    "createCollection",
    "dropCollection",
    "dropDatabase",
    "renameCollection",
  ],
};

/**
 * Conexiones protegidas (read-only)
 * @type {Set<mongoose.Connection>}
 */
const protectedConnections = new Set();

/**
 * Métodos originales guardados para restauración
 * @type {Map<string, Function>}
 */
const originalMethods = new Map();

/**
 * Estado de protección
 */
let protectionEnabled = false;

// ============================================================================
// CLASE DE ERROR PERSONALIZADA
// ============================================================================

/**
 * Error específico para operaciones de escritura bloqueadas
 */
class ProductionWriteBlockedError extends Error {
  constructor(operation, collection = "unknown") {
    super(
      `🚨 OPERACIÓN DE ESCRITURA BLOQUEADA EN PRODUCCIÓN\n` +
        `   Operación: ${operation}\n` +
        `   Colección: ${collection}\n` +
        `   Motivo: La conexión de producción es de solo lectura.\n` +
        `   Acción: Use la base de datos local para operaciones de escritura.`,
    );
    this.name = "ProductionWriteBlockedError";
    this.operation = operation;
    this.collection = collection;
    this.code = "PRODUCTION_WRITE_BLOCKED";
    this.statusCode = 403;
  }
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Verifica si una conexión está protegida
 * @param {mongoose.Connection} connection - Conexión a verificar
 * @returns {boolean} true si está protegida
 */
function isProtectedConnection(connection) {
  if (!connection) return false;
  return protectedConnections.has(connection);
}

/**
 * Obtiene el nombre de la colección de un modelo o contexto
 * @param {Object} context - Contexto (this) de la operación
 * @returns {string} Nombre de la colección
 */
function getCollectionName(context) {
  if (!context) return "unknown";

  if (context.collection?.name) return context.collection.name;
  if (context.modelName) return context.modelName;
  if (context.model?.modelName) return context.model.modelName;
  if (context.constructor?.modelName) return context.constructor.modelName;
  if (typeof context === "string") return context;

  return "unknown";
}

/**
 * Obtiene la conexión de un modelo o contexto
 * @param {Object} context - Contexto (this) de la operación
 * @returns {mongoose.Connection|null} Conexión
 */
function getConnection(context) {
  if (!context) return null;

  if (context.db) return context.db;
  if (context.connection) return context.connection;
  if (context.model?.db) return context.model.db;
  if (context.constructor?.db) return context.constructor.db;
  if (context.base?.connection) return context.base.connection;

  return mongoose.connection;
}

/**
 * Crea un wrapper que bloquea operaciones en conexiones protegidas
 * @param {Function} originalFn - Función original
 * @param {string} operationName - Nombre de la operación
 * @returns {Function} Función wrapeada
 */
function createBlockingWrapper(originalFn, operationName) {
  return function (...args) {
    const connection = getConnection(this);
    const collectionName = getCollectionName(this);

    if (isProtectedConnection(connection)) {
      syncLogger.protectionTriggered(operationName, collectionName);
      throw new ProductionWriteBlockedError(operationName, collectionName);
    }

    return originalFn.apply(this, args);
  };
}

/**
 * Crea un wrapper async que bloquea operaciones en conexiones protegidas
 * @param {Function} originalFn - Función original
 * @param {string} operationName - Nombre de la operación
 * @returns {Function} Función wrapeada
 */
function createAsyncBlockingWrapper(originalFn, operationName) {
  return async function (...args) {
    const connection = getConnection(this);
    const collectionName = getCollectionName(this);

    if (isProtectedConnection(connection)) {
      syncLogger.protectionTriggered(operationName, collectionName);
      throw new ProductionWriteBlockedError(operationName, collectionName);
    }

    return originalFn.apply(this, args);
  };
}

/**
 * Determina si una URI corresponde al target de producción configurado.
 * @param {string} targetUri - URI que se desea verificar
 * @param {Object} env - Variables de entorno
 * @returns {boolean}
 */
export function isProductionUriTarget(targetUri, env = process.env) {
  const normalizedTarget = normalizeMongoUri(targetUri);
  if (!normalizedTarget) return false;

  const prodUris = resolveConfiguredProductionUris(env);
  if (prodUris.length === 0) return false;

  return prodUris.some((candidate) => {
    const normalizedCandidate = normalizeMongoUri(candidate);
    return normalizedCandidate && normalizedCandidate === normalizedTarget;
  });
}

/**
 * En entornos no productivos, si una conexión apunta a producción,
 * registra protección read-only estricta y bloquea escrituras.
 * @param {mongoose.Connection} connection
 * @param {string} targetUri
 * @param {Object} options
 * @returns {boolean} true si se aplicó la protección
 */
export function enforceReadOnlyForProtectedProductionUri(
  connection,
  targetUri,
  options = {},
) {
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || "development";
  const env = options.env || process.env;
  const enableGlobalProtection = options.enableGlobalProtection !== false;

  if (nodeEnv === "production") {
    return false;
  }

  if (!isProductionUriTarget(targetUri, env)) {
    return false;
  }

  registerProtectedConnection(connection);

  if (enableGlobalProtection && !protectionEnabled) {
    enableWriteProtection();
  }

  syncLogger.warn(
    `Muro de Producción activo en ${nodeEnv}: la URI de producción quedó en modo READ-ONLY estricto.`,
  );

  return true;
}

// ============================================================================
// FUNCIONES DE PROTECCIÓN
// ============================================================================

/**
 * Protege los métodos de Model
 */
function protectModelMethods() {
  const Model = mongoose.Model;

  for (const methodName of WRITE_METHODS.model) {
    if (typeof Model[methodName] === "function") {
      const key = `Model.${methodName}`;
      if (!originalMethods.has(key)) {
        originalMethods.set(key, Model[methodName]);
        Model[methodName] = createAsyncBlockingWrapper(
          Model[methodName],
          methodName,
        );
        syncLogger.debug(`Protegido: Model.${methodName}`);
      }
    }

    // También proteger en el prototype
    if (typeof Model.prototype[methodName] === "function") {
      const key = `Model.prototype.${methodName}`;
      if (!originalMethods.has(key)) {
        originalMethods.set(key, Model.prototype[methodName]);
        Model.prototype[methodName] = createAsyncBlockingWrapper(
          Model.prototype[methodName],
          methodName,
        );
        syncLogger.debug(`Protegido: Model.prototype.${methodName}`);
      }
    }
  }
}

/**
 * Protege los métodos de Document
 */
function protectDocumentMethods() {
  const Document = mongoose.Document;

  for (const methodName of WRITE_METHODS.document) {
    if (typeof Document.prototype[methodName] === "function") {
      const key = `Document.prototype.${methodName}`;
      if (!originalMethods.has(key)) {
        originalMethods.set(key, Document.prototype[methodName]);
        Document.prototype[methodName] = createAsyncBlockingWrapper(
          Document.prototype[methodName],
          methodName,
        );
        syncLogger.debug(`Protegido: Document.prototype.${methodName}`);
      }
    }
  }
}

/**
 * Protege los métodos de Query
 */
function protectQueryMethods() {
  const Query = mongoose.Query;

  for (const methodName of WRITE_METHODS.query) {
    if (typeof Query.prototype[methodName] === "function") {
      const key = `Query.prototype.${methodName}`;
      if (!originalMethods.has(key)) {
        originalMethods.set(key, Query.prototype[methodName]);
        Query.prototype[methodName] = createBlockingWrapper(
          Query.prototype[methodName],
          methodName,
        );
        syncLogger.debug(`Protegido: Query.prototype.${methodName}`);
      }
    }
  }
}

/**
 * Protege una conexión específica a nivel de colección
 * @param {mongoose.Connection} connection - Conexión a proteger
 */
function protectConnectionCollections(connection) {
  if (!connection || !connection.db) return;

  const originalCollection = connection.db.collection.bind(connection.db);

  connection.db.collection = function (name, options) {
    const collection = originalCollection(name, options);

    // Proteger métodos de la colección
    for (const methodName of WRITE_METHODS.collection) {
      if (typeof collection[methodName] === "function") {
        const originalMethod = collection[methodName].bind(collection);

        collection[methodName] = function (...args) {
          syncLogger.protectionTriggered(methodName, name);
          throw new ProductionWriteBlockedError(methodName, name);
        };
      }
    }

    return collection;
  };

  syncLogger.debug(
    `Colecciones protegidas para conexión: ${connection.name || "default"}`,
  );
}

/**
 * Instala pre-hooks de Mongoose para bloquear escrituras
 * @param {mongoose.Connection} connection - Conexión a proteger
 */
function installPreHooks(connection) {
  // Pre-hook para 'save' en todos los esquemas
  connection.on("model", (model) => {
    const schema = model.schema;

    schema.pre("save", function (next) {
      const docConnection = this.db || this.constructor.db;
      if (isProtectedConnection(docConnection)) {
        return next(
          new ProductionWriteBlockedError("save", this.constructor.modelName),
        );
      }
      next();
    });

    schema.pre("remove", function (next) {
      const docConnection = this.db || this.constructor.db;
      if (isProtectedConnection(docConnection)) {
        return next(
          new ProductionWriteBlockedError("remove", this.constructor.modelName),
        );
      }
      next();
    });

    schema.pre("deleteOne", function (next) {
      if (isProtectedConnection(getConnection(this))) {
        return next(
          new ProductionWriteBlockedError("deleteOne", getCollectionName(this)),
        );
      }
      next();
    });

    schema.pre("updateOne", function (next) {
      if (isProtectedConnection(getConnection(this))) {
        return next(
          new ProductionWriteBlockedError("updateOne", getCollectionName(this)),
        );
      }
      next();
    });

    syncLogger.debug(`Hooks instalados para modelo: ${model.modelName}`);
  });
}

// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Registra una conexión como protegida (read-only)
 * @param {mongoose.Connection} connection - Conexión a proteger
 */
export function registerProtectedConnection(connection) {
  if (!connection) {
    throw new Error("Se requiere una conexión para registrar");
  }

  protectedConnections.add(connection);
  protectConnectionCollections(connection);
  installPreHooks(connection);

  syncLogger.info(
    `Conexión registrada como protegida: ${connection.name || connection.host || "default"}`,
  );
}

/**
 * Elimina una conexión de la lista de protegidas
 * @param {mongoose.Connection} connection - Conexión a desproteger
 */
export function unregisterProtectedConnection(connection) {
  if (connection) {
    protectedConnections.delete(connection);
    syncLogger.info(
      `Conexión removida de protegidas: ${connection.name || "default"}`,
    );
  }
}

/**
 * Activa la protección global de escritura
 */
export function enableWriteProtection() {
  if (protectionEnabled) {
    syncLogger.warn("La protección de escritura ya está activa");
    return;
  }

  syncLogger.info("Activando protección de escritura a nivel driver...");

  protectModelMethods();
  protectDocumentMethods();
  protectQueryMethods();

  protectionEnabled = true;

  syncLogger.success("Protección de escritura activada");
}

/**
 * Desactiva la protección global de escritura (para pruebas)
 * ⚠️ PELIGROSO: Solo usar en entornos de prueba
 */
export function disableWriteProtection() {
  if (!protectionEnabled) {
    return;
  }

  syncLogger.warn("⚠️ Desactivando protección de escritura...");

  // Restaurar métodos originales
  for (const [key, originalFn] of originalMethods) {
    const [target, ...methodParts] = key.split(".");
    const methodName = methodParts.join(".");

    if (target === "Model") {
      if (key.includes("prototype")) {
        mongoose.Model.prototype[methodName.replace("prototype.", "")] =
          originalFn;
      } else {
        mongoose.Model[methodName] = originalFn;
      }
    } else if (target === "Document") {
      mongoose.Document.prototype[methodName.replace("prototype.", "")] =
        originalFn;
    } else if (target === "Query") {
      mongoose.Query.prototype[methodName.replace("prototype.", "")] =
        originalFn;
    }
  }

  originalMethods.clear();
  protectedConnections.clear();
  protectionEnabled = false;

  syncLogger.warn("Protección de escritura desactivada");
}

/**
 * Verifica si la protección está activa
 * @returns {boolean} true si está activa
 */
export function isProtectionEnabled() {
  return protectionEnabled;
}

/**
 * Obtiene el número de conexiones protegidas
 * @returns {number} Número de conexiones protegidas
 */
export function getProtectedConnectionsCount() {
  return protectedConnections.size;
}

/**
 * Crea un modelo seguro que lanza error en operaciones de escritura
 * @param {mongoose.Connection} connection - Conexión protegida
 * @param {string} name - Nombre del modelo
 * @param {mongoose.Schema} schema - Esquema del modelo
 * @returns {mongoose.Model} Modelo con métodos de escritura bloqueados
 */
export function createReadOnlyModel(connection, name, schema) {
  const model = connection.model(name, schema);

  // Sobrescribir métodos de escritura
  for (const methodName of WRITE_METHODS.model) {
    if (typeof model[methodName] === "function") {
      model[methodName] = async function () {
        throw new ProductionWriteBlockedError(methodName, name);
      };
    }
  }

  syncLogger.debug(`Modelo read-only creado: ${name}`);
  return model;
}

/**
 * Middleware de Express para verificar conexión antes de operaciones de escritura
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Siguiente middleware
 */
export function writeProtectionMiddleware(req, res, next) {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];

  if (writeMethods.includes(req.method)) {
    const connection = mongoose.connection;

    if (isProtectedConnection(connection)) {
      syncLogger.protectionTriggered(`HTTP ${req.method}`, req.originalUrl);
      return res.status(403).json({
        success: false,
        error: "PRODUCTION_WRITE_BLOCKED",
        message:
          "Las operaciones de escritura están bloqueadas en la conexión de producción",
        operation: req.method,
        path: req.originalUrl,
      });
    }
  }

  next();
}

/**
 * Instala protección completa en una conexión
 * @param {mongoose.Connection} connection - Conexión a proteger
 * @param {Object} options - Opciones
 * @param {boolean} options.enableGlobalProtection - Si activar protección global
 */
export function installFullProtection(connection, options = {}) {
  const { enableGlobalProtection = true } = options;

  registerProtectedConnection(connection);

  if (enableGlobalProtection && !protectionEnabled) {
    enableWriteProtection();
  }

  syncLogger.success(
    `Protección completa instalada para: ${connection.name || connection.host || "default"}`,
  );
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export { ProductionWriteBlockedError };

export default {
  registerProtectedConnection,
  unregisterProtectedConnection,
  enableWriteProtection,
  disableWriteProtection,
  isProtectionEnabled,
  isProductionUriTarget,
  enforceReadOnlyForProtectedProductionUri,
  getProtectedConnectionsCount,
  createReadOnlyModel,
  writeProtectionMiddleware,
  installFullProtection,
  ProductionWriteBlockedError,
  WRITE_METHODS,
};
