import mongoose from "mongoose";
import GamificationConfig from "./models/GamificationConfig.js";
import dotenv from "dotenv";

dotenv.config();

const updateGamificationConfig = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado");

    // Buscar configuración existente
    let config = await GamificationConfig.findOne();

    if (!config) {
      console.log("⚠️  No existe configuración. Creando nueva...");
      config = await GamificationConfig.create({
        evaluationPeriod: "weekly",
        top1CommissionBonus: 5,
        top2CommissionBonus: 3,
        top3CommissionBonus: 1,
        minAdminProfitForRanking: 100000,
        currentPeriodStart: new Date(),
      });
      console.log("✅ Configuración creada exitosamente");
    } else {
      console.log("📊 Configuración actual:");
      console.log(`  - Periodo: ${config.evaluationPeriod}`);
      console.log(`  - Bonus 1º: +${config.top1CommissionBonus}%`);
      console.log(`  - Bonus 2º: +${config.top2CommissionBonus}%`);
      console.log(`  - Bonus 3º: +${config.top3CommissionBonus}%`);
      console.log(`  - Ganancia mínima admin: $${config.minAdminProfitForRanking?.toLocaleString('es-CO') || 'No definido'}`);

      // Actualizar configuración
      config.evaluationPeriod = "weekly";
      config.top3CommissionBonus = 1; // Corregir si era 2
      
      // Agregar campo nuevo si no existe
      if (!config.minAdminProfitForRanking) {
        config.minAdminProfitForRanking = 100000;
      }

      // Establecer inicio de periodo semanal (domingo)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      config.currentPeriodStart = startOfWeek;

      await config.save();

      console.log("\n✅ Configuración actualizada:");
      console.log(`  - Periodo: ${config.evaluationPeriod} ✅`);
      console.log(`  - Bonus 1º: +${config.top1CommissionBonus}% (25% total)`);
      console.log(`  - Bonus 2º: +${config.top2CommissionBonus}% (23% total)`);
      console.log(`  - Bonus 3º: +${config.top3CommissionBonus}% (21% total)`);
      console.log(`  - Ganancia mínima admin para ranking: $${config.minAdminProfitForRanking.toLocaleString('es-CO')} ✅`);
      console.log(`  - Inicio del periodo actual: ${startOfWeek.toLocaleString('es-CO', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("📋 RESUMEN DE CAMBIOS:");
    console.log("=".repeat(80));
    console.log("1️⃣  Rankings se reinician SEMANALMENTE (domingo a sábado)");
    console.log("2️⃣  Requisito mínimo: Generar $100,000 en ganancia para el admin");
    console.log("3️⃣  Solo distribuidores que cumplan el requisito aparecen en ranking");
    console.log("4️⃣  Top 3 mantienen bonos: +5%, +3%, +1%");
    console.log("=".repeat(80));

    await mongoose.connection.close();
    console.log("\n✅ Conexión cerrada.");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

updateGamificationConfig();
