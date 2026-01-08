/**
 * Script para corregir el status de distribuidores existentes
 * Los distribuidores creados antes del fix tenían status: "pending" por defecto
 * Este script los actualiza a status: "active"
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

async function fixDistributorStatus() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Encontrar todos los distribuidores con status pending
    const pendingDistributors = await User.find({
      role: "distribuidor",
      status: "pending",
    }).select("_id name email status");

    console.log(
      `\n📋 Encontrados ${pendingDistributors.length} distribuidores con status "pending":`
    );

    if (pendingDistributors.length === 0) {
      console.log("✅ No hay distribuidores que corregir");
      await mongoose.disconnect();
      return;
    }

    pendingDistributors.forEach((d) => {
      console.log(`   - ${d.name} (${d.email})`);
    });

    // Actualizar todos a status: "active"
    const result = await User.updateMany(
      { role: "distribuidor", status: "pending" },
      { $set: { status: "active" } }
    );

    console.log(
      `\n✅ Actualizados ${result.modifiedCount} distribuidores a status "active"`
    );

    // Verificar el cambio
    const stillPending = await User.countDocuments({
      role: "distribuidor",
      status: "pending",
    });

    console.log(
      `\n📊 Distribuidores con status "pending" restantes: ${stillPending}`
    );

    await mongoose.disconnect();
    console.log("\n🔌 Desconectado de MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixDistributorStatus();
