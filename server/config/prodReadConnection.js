/**
 * Conexión de SOLO LECTURA a la base de datos de Producción
 * ⚠️ NUNCA se debe escribir, actualizar o eliminar datos desde esta conexión
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const PROD_URI = process.env.MONGO_URI_PROD_READ;

// Validación crítica: bloquear si no hay URI de producción configurada
if (!PROD_URI && process.env.NODE_ENV === "development") {
  console.warn(
    "⚠️ MONGO_URI_PROD_READ no configurada. Sincronización deshabilitada.",
  );
}

// Conexión separada para producción (read-only)
let prodConnection = null;

/**
 * Lista de operaciones bloqueadas para producción
 */
const BLOCKED_OPERATIONS = [
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "replaceOne",
  "bulkWrite",
  "drop",
  "dropCollection",
  "dropDatabase",
  "createIndex",
  "dropIndex",
  "dropIndexes",
];

/**
 * Conectar a producción en modo SOLO LECTURA
 * @returns {Promise<mongoose.Connection>}
 */
export const connectProdReadOnly = async () => {
  if (!PROD_URI) {
    throw new Error(
      "❌ MONGO_URI_PROD_READ no está definida. No se puede conectar a producción.",
    );
  }

  // SEGURIDAD: Verificar que la URI no permita escritura accidental
  if (PROD_URI.includes("w=majority") && !PROD_URI.includes("readPreference")) {
    console.warn(
      "⚠️ URI de producción tiene permisos de escritura. Añadiendo readPreference=secondary",
    );
  }

  try {
    prodConnection = mongoose.createConnection(PROD_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5, // Pool pequeño para solo lectura
      readPreference: "secondaryPreferred", // Preferir réplicas secundarias
    });

    prodConnection.on("connected", () => {
      console.log("✅ [PROD-READ] Conexión establecida (SOLO LECTURA)");
    });

    prodConnection.on("error", (err) => {
      console.error("❌ [PROD-READ] Error de conexión:", err.message);
    });

    // PROTECCIÓN CRÍTICA: Interceptar y bloquear operaciones de escritura
    installWriteProtection(prodConnection);

    await prodConnection.asPromise();
    return prodConnection;
  } catch (error) {
    console.error("❌ Error conectando a producción:", error.message);
    throw error;
  }
};

/**
 * Instala protección contra escritura en la conexión de producción
 * @param {mongoose.Connection} connection
 */
const installWriteProtection = (connection) => {
  const originalModel = connection.model.bind(connection);

  connection.model = function (name, schema, collection) {
    const model = originalModel(name, schema, collection);

    // Interceptar métodos de escritura
    BLOCKED_OPERATIONS.forEach((operation) => {
      if (typeof model[operation] === "function") {
        const originalMethod = model[operation].bind(model);
        model[operation] = function (...args) {
          const error = new Error(
            `❌ BLOQUEADO: Operación "${operation}" no permitida en producción.\n` +
              `   Modelo: ${name}\n` +
              `   Esta conexión es de SOLO LECTURA.`,
          );
          console.error(error.message);
          throw error;
        };
      }
    });

    // Bloquear save() en instancias
    if (schema) {
      schema.pre("save", function (next) {
        const error = new Error(
          `❌ BLOQUEADO: save() no permitido en producción para ${name}`,
        );
        console.error(error.message);
        next(error);
      });

      schema.pre("remove", function (next) {
        const error = new Error(
          `❌ BLOQUEADO: remove() no permitido en producción para ${name}`,
        );
        console.error(error.message);
        next(error);
      });
    }

    return model;
  };
};

/**
 * Obtener la conexión de producción activa
 * @returns {mongoose.Connection|null}
 */
export const getProdConnection = () => prodConnection;

/**
 * Cerrar la conexión de producción
 */
export const closeProdConnection = async () => {
  if (prodConnection) {
    await prodConnection.close();
    prodConnection = null;
    console.log("🔌 [PROD-READ] Conexión cerrada");
  }
};

export default {
  connectProdReadOnly,
  getProdConnection,
  closeProdConnection,
};
