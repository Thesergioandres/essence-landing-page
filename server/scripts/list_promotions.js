import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import "../models/Product.js";
import Promotion from "../models/Promotion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("🎁 Buscando Promociones...");
    const promos = await Promotion.find({})
      .limit(5)
      .populate("comboItems.product");

    if (promos.length === 0) {
      console.log("   ❌ No se encontraron promociones.");
    }

    promos.forEach((p) => {
      console.log(`\n📌 Nombre: ${p.name}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Type: ${p.type}`);
      console.log(`   DistPrice: ${p.distributorPrice}`);
      console.log(`   Items:`);
      p.comboItems.forEach((i) => {
        console.log(
          `     - ${i.product ? i.product.name : "NULL"} (Qty: ${i.quantity})`,
        );
      });
    });
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
