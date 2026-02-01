import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function testTransactions() {
  const mongoUri =
    process.env.MONGO_URI_DEV_LOCAL ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/essence_local";

  console.log(`🔌 Conectando a: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Conectado a MongoDB");

    console.log("🔄 Intentando iniciar sesión...");
    const session = await mongoose.startSession();
    console.log("✅ Sesión iniciada");

    console.log("🔄 Intentando iniciar transacción...");
    try {
      session.startTransaction();
      console.log("✅ Transacción iniciada satisfactoriamente");
      await session.abortTransaction();
      console.log("✅ Transacción abortada correctamente");
    } catch (txError) {
      console.error("❌ Error al iniciar transacción:", txError.message);
      if (txError.message.includes("replica set")) {
        console.log(
          "💡 Confirmado: El servidor MongoDB no es un Replica Set. Las transacciones no están soportadas.",
        );
      }
    } finally {
      session.endSession();
      console.log("🔚 Sesión finalizada");
    }
  } catch (error) {
    console.error("❌ Error fatal:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado");
  }
}

testTransactions();
