import mongoose from "mongoose";
import dotenv from "dotenv";
import { recordSpecialSaleProfit } from "./services/profitHistory.service.js";
import SpecialSale from "./models/SpecialSale.js";
import ProfitHistory from "./models/ProfitHistory.js";
import User from "./models/User.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  }
};

const fixSpecialSalesHistory = async () => {
  try {
    await connectDB();

    console.log("\n🔧 CORRIGIENDO HISTORIAL DE VENTAS ESPECIALES\n");
    console.log("=".repeat(80));

    // Buscar admin
    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      console.error("❌ No se encontró usuario admin");
      return;
    }
    console.log(`\n✅ Admin encontrado: ${admin.name} (${admin.email})`);

    // Buscar todas las ventas especiales
    const specialSales = await SpecialSale.find().sort({ saleDate: 1 });
    console.log(`\n📋 Total de ventas especiales: ${specialSales.length}`);

    let fixed = 0;
    let skipped = 0;

    for (const sale of specialSales) {
      // Verificar si ya tiene historial para el admin
      const hasAdminHistory = await ProfitHistory.findOne({
        specialSale: sale._id,
        user: admin._id
      });

      if (hasAdminHistory) {
        console.log(`⏭️  SKIP: ${sale.saleDate?.toISOString().split('T')[0]} | ${sale.product?.name} - Ya tiene historial`);
        skipped++;
        continue;
      }

      // Verificar si tiene distribución al admin
      const adminDist = sale.distribution?.find(d => d.name?.toLowerCase().includes("admin"));
      if (!adminDist) {
        console.log(`⏭️  SKIP: ${sale.saleDate?.toISOString().split('T')[0]} | ${sale.product?.name} - No tiene distribución al admin`);
        skipped++;
        continue;
      }

      console.log(`\n🔄 Procesando: ${sale.saleDate?.toISOString().split('T')[0]} | ${sale.product?.name}`);
      console.log(`   Monto admin: $${adminDist.amount.toFixed(3)}`);

      try {
        // Usar la función de servicio para registrar
        await recordSpecialSaleProfit(sale._id);
        console.log(`   ✅ Historial creado exitosamente`);
        fixed++;
      } catch (error) {
        console.error(`   ❌ Error creando historial:`, error.message);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 RESUMEN:`);
    console.log(`   ✅ Corregidas: ${fixed}`);
    console.log(`   ⏭️  Omitidas: ${skipped}`);
    console.log(`   📋 Total procesadas: ${specialSales.length}`);

    // Verificar balance final del admin
    const adminHistory = await ProfitHistory.aggregate([
      { $match: { user: admin._id } },
      { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$amount" } } }
    ]);

    console.log(`\n💰 Balance actualizado del admin por tipo:`);
    for (const group of adminHistory) {
      console.log(`   - ${group._id}: ${group.count} entradas, Total: $${group.total.toFixed(3)}`);
    }

    console.log("\n✅ Corrección completada\n");

  } catch (error) {
    console.error("❌ Error en corrección:", error);
  } finally {
    await mongoose.disconnect();
  }
};

fixSpecialSalesHistory();
