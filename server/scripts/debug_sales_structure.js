import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Sale from "../src/infrastructure/database/models/Sale.js";

// Configurar entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // console.log("Conectado a MongoDB");

    // Buscar ventas recientes (desde el 18 de enero)
    const startDate = new Date("2026-01-18T00:00:00.000Z");

    const sales = await Sale.find({
      saleDate: { $gte: startDate },
    })
      .select("_id saleId saleGroupId quantity salePrice customer createdAt")
      .lean();

    // Output as simple JSON string for easy parsing
    console.log(JSON.stringify(sales, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

run();
