/**
 * Conexión de LECTURA Y ESCRITURA a la base de datos Local
 * Esta es la base de datos principal para desarrollo
 * Todos los cambios se guardan aquí y persisten entre sesiones
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const LOCAL_URI = process.env.MONGO_URI_DEV_LOCAL || process.env.MONGODB_URI;

// Opciones de conexión
const mongoOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
};

/**
 * Conectar a la base de datos local (lectura + escritura)
 * @returns {Promise<mongoose.Connection>}
 */
export const connectLocalDB = async () => {
  if (!LOCAL_URI) {
    throw new Error(
      "❌ MONGO_URI_DEV_LOCAL no está definida. No se puede conectar a la BD local.",
    );
  }

  // SEGURIDAD: Verificar que no estamos conectando a producción por error
  const prodUri = process.env.MONGO_URI_PROD_READ;
  if (prodUri && LOCAL_URI === prodUri) {
    throw new Error(
      "❌ PELIGRO: La URI local es igual a la URI de producción.\n" +
        "   Esto podría causar escrituras accidentales en producción.\n" +
        "   Por favor, configura una base de datos local separada.",
    );
  }

  try {
    await mongoose.connect(LOCAL_URI, mongoOptions);
    console.log(`✅ [LOCAL-RW] Conectado a: ${mongoose.connection.host}`);
    console.log(`   Base de datos: ${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (error) {
    console.error("❌ Error conectando a BD local:", error.message);
    throw error;
  }
};

/**
 * Obtener la conexión local activa (usa mongoose.connection por defecto)
 * @returns {mongoose.Connection}
 */
export const getLocalConnection = () => mongoose.connection;

/**
 * Cerrar la conexión local
 */
export const closeLocalConnection = async () => {
  await mongoose.connection.close();
  console.log("🔌 [LOCAL-RW] Conexión cerrada");
};

/**
 * Verificar que la conexión local está activa
 * @returns {boolean}
 */
export const isLocalConnected = () => mongoose.connection.readyState === 1;

export default {
  connectLocalDB,
  getLocalConnection,
  closeLocalConnection,
  isLocalConnected,
};
