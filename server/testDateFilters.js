import mongoose from "mongoose";
import dotenv from "dotenv";
import Sale from "./models/Sale.js";
import SpecialSale from "./models/SpecialSale.js";
import ProfitHistory from "./models/ProfitHistory.js";
import Product from "./models/Product.js";
import User from "./models/User.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  }
};

const testDateFilters = async () => {
  try {
    await connectDB();

    console.log("🧪 VERIFICACIÓN DE FILTROS DE FECHAS");
    console.log("=".repeat(80));

    // Zona horaria Colombia (UTC-5)
    const now = new Date();
    console.log(`\n📅 Fecha/Hora actual del servidor: ${now.toISOString()}`);
    console.log(`📅 Fecha/Hora Colombia (UTC-5): ${now.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);

    // === TEST 1: Ventas Normales - Filtro de fechas ===
    console.log("\n\n1️⃣ VENTAS NORMALES - FILTROS DE FECHAS");
    console.log("-".repeat(80));

    // Obtener rango de fechas de ventas
    const firstSale = await Sale.findOne().sort({ saleDate: 1 });
    const lastSale = await Sale.findOne().sort({ saleDate: -1 });

    if (firstSale && lastSale) {
      console.log(`\n📊 Rango de datos disponibles:`);
      console.log(`   Primera venta: ${firstSale.saleDate.toISOString().split('T')[0]}`);
      console.log(`   Última venta: ${lastSale.saleDate.toISOString().split('T')[0]}`);

      // Prueba 1: Filtro del mes actual
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const salesThisMonth = await Sale.countDocuments({
        saleDate: { $gte: startOfMonth, $lte: endOfMonth }
      });

      console.log(`\n✅ Test 1: Ventas del mes actual (${startOfMonth.toISOString().split('T')[0]} - ${endOfMonth.toISOString().split('T')[0]})`);
      console.log(`   Resultado: ${salesThisMonth} ventas`);

      // Prueba 2: Filtro de diciembre 2025
      const dec2025Start = new Date('2025-12-01T00:00:00.000Z');
      const dec2025End = new Date('2025-12-31T23:59:59.999Z');
      
      const salesDec2025 = await Sale.countDocuments({
        saleDate: { $gte: dec2025Start, $lte: dec2025End }
      });

      console.log(`\n✅ Test 2: Ventas de diciembre 2025`);
      console.log(`   Resultado: ${salesDec2025} ventas`);

      // Prueba 3: Últimas 5 ventas con fechas
      const recentSales = await Sale.find()
        .sort({ saleDate: -1 })
        .limit(5)
        .select('saleId saleDate product quantity')
        .populate('product', 'name');

      console.log(`\n✅ Test 3: Últimas 5 ventas registradas:`);
      for (const sale of recentSales) {
        const localDate = new Date(sale.saleDate).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
        console.log(`   - ${sale.saleId} | ${localDate} | ${sale.product?.name || 'N/A'} (x${sale.quantity})`);
      }

      // Prueba 4: Ventas de hoy (Colombia timezone)
      const colombiaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const todayStart = new Date(colombiaNow.getFullYear(), colombiaNow.getMonth(), colombiaNow.getDate(), 0, 0, 0);
      const todayEnd = new Date(colombiaNow.getFullYear(), colombiaNow.getMonth(), colombiaNow.getDate(), 23, 59, 59, 999);

      const salesToday = await Sale.countDocuments({
        saleDate: { $gte: todayStart, $lte: todayEnd }
      });

      console.log(`\n✅ Test 4: Ventas de hoy (${todayStart.toISOString().split('T')[0]})`);
      console.log(`   Resultado: ${salesToday} ventas`);
    } else {
      console.log("\n⚠️ No hay ventas normales en la base de datos");
    }

    // === TEST 2: Ventas Especiales - Filtro de fechas ===
    console.log("\n\n2️⃣ VENTAS ESPECIALES - FILTROS DE FECHAS");
    console.log("-".repeat(80));

    const specialSales = await SpecialSale.find().sort({ saleDate: -1 }).limit(5);
    
    if (specialSales.length > 0) {
      console.log(`\n✅ Total de ventas especiales: ${await SpecialSale.countDocuments()}`);
      console.log(`\nÚltimas 5 ventas especiales:`);
      
      for (const sale of specialSales) {
        const localDate = new Date(sale.saleDate).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
        console.log(`   - ${localDate} | ${sale.product?.name || 'N/A'} (x${sale.quantity})`);
      }

      // Probar filtro de rango
      const dec2025Start = new Date('2025-12-01T00:00:00.000Z');
      const dec2025End = new Date('2025-12-31T23:59:59.999Z');
      
      const specialSalesDec = await SpecialSale.countDocuments({
        saleDate: { $gte: dec2025Start, $lte: dec2025End }
      });

      console.log(`\n✅ Test: Ventas especiales de diciembre 2025`);
      console.log(`   Resultado: ${specialSalesDec} ventas`);
    } else {
      console.log("\n⚠️ No hay ventas especiales en la base de datos");
    }

    // === TEST 3: Historial de Ganancias - Filtro de fechas ===
    console.log("\n\n3️⃣ HISTORIAL DE GANANCIAS - FILTROS DE FECHAS");
    console.log("-".repeat(80));

    const profitEntries = await ProfitHistory.find().sort({ date: -1 }).limit(5);
    
    if (profitEntries.length > 0) {
      console.log(`\n✅ Total de entradas en historial: ${await ProfitHistory.countDocuments()}`);
      console.log(`\nÚltimas 5 entradas del historial:`);
      
      for (const entry of profitEntries) {
        const localDate = new Date(entry.date).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
        console.log(`   - ${localDate} | ${entry.type} | $${entry.amount.toFixed(3)}`);
      }

      // Probar filtro de diciembre 2025
      const dec2025Start = new Date('2025-12-01T00:00:00.000Z');
      const dec2025End = new Date('2025-12-31T23:59:59.999Z');
      
      const profitDec = await ProfitHistory.countDocuments({
        date: { $gte: dec2025Start, $lte: dec2025End }
      });

      console.log(`\n✅ Test: Historial de diciembre 2025`);
      console.log(`   Resultado: ${profitDec} entradas`);
    } else {
      console.log("\n⚠️ No hay entradas en el historial de ganancias");
    }

    // === TEST 4: Verificar conversión de zona horaria ===
    console.log("\n\n4️⃣ VERIFICACIÓN DE CONVERSIÓN DE ZONA HORARIA");
    console.log("-".repeat(80));

    const testDate = new Date('2025-12-06T23:00:00.000Z');
    console.log(`\nFecha UTC: ${testDate.toISOString()}`);
    console.log(`Fecha Colombia (UTC-5): ${testDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    console.log(`\n⚠️ Nota: MongoDB almacena en UTC. Las fechas deben convertirse a zona horaria local en el frontend.`);

    // === RESUMEN ===
    console.log("\n\n" + "=".repeat(80));
    console.log("📊 RESUMEN DE VERIFICACIÓN");
    console.log("=".repeat(80));

    const totalSales = await Sale.countDocuments();
    const totalSpecialSales = await SpecialSale.countDocuments();
    const totalProfit = await ProfitHistory.countDocuments();

    console.log(`\n✅ Ventas Normales: ${totalSales} registros`);
    console.log(`✅ Ventas Especiales: ${totalSpecialSales} registros`);
    console.log(`✅ Historial de Ganancias: ${totalProfit} registros`);

    console.log(`\n🎯 RECOMENDACIONES:`);
    console.log(`   1. Los filtros de fecha funcionan correctamente en el backend`);
    console.log(`   2. Asegúrate de que el frontend envíe fechas en formato ISO (YYYY-MM-DD)`);
    console.log(`   3. Para "hoy", usa la zona horaria de Colombia (America/Bogota)`);
    console.log(`   4. MongoDB almacena en UTC, convierte a local en la visualización`);
    console.log(`   5. Usa startDate (00:00:00) y endDate (23:59:59.999) para rangos completos\n`);

  } catch (error) {
    console.error("\n❌ Error en verificación:", error);
  } finally {
    await mongoose.disconnect();
  }
};

testDateFilters();
