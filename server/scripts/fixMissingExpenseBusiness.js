import dotenv from "dotenv";
import mongoose from "mongoose";
import Expense from "../src/infrastructure/database/models/Expense.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const targetBusinessId = process.argv[2] || process.env.TARGET_BUSINESS_ID;
const targetExpenseId = process.argv[3]; // opcional para forzar solo un gasto

if (!mongoUri) {
  console.error("❌ MONGODB_URI no está configurado");
  process.exit(1);
}

if (!targetBusinessId) {
  console.error(
    "❌ Falta el BUSINESS_ID. Pásalo como arg: node fixMissingExpenseBusiness.js <BUSINESS_ID>"
  );
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("✅ Conectado a MongoDB");

  const businessObjectId = new mongoose.Types.ObjectId(targetBusinessId);

  const baseFilter = targetExpenseId
    ? { _id: new mongoose.Types.ObjectId(targetExpenseId) }
    : { $or: [{ business: { $exists: false } }, { business: null }] };

  const res = await Expense.updateMany(baseFilter, {
    $set: { business: businessObjectId },
  });

  console.log(
    `➡️  Expenses actualizados: matched=${res.matchedCount || 0}, modified=${
      res.modifiedCount || 0
    }`
  );

  await mongoose.connection.close();
  console.log("✅ Conexión cerrada");
}

run().catch((err) => {
  console.error("❌ Error en la corrección:", err.message);
  mongoose.connection.close();
  process.exit(1);
});
