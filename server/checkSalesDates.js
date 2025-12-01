import mongoose from "mongoose";
import dotenv from "dotenv";
import Sale from "./models/Sale.js";

dotenv.config();

const checkSalesDates = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log("\n📅 Fecha actual:", now.toISOString());
    console.log("📅 Inicio mes actual:", startOfMonth.toISOString());
    console.log("📅 Fin mes actual:", endOfMonth.toISOString());

    // Todas las ventas
    const allSales = await Sale.find().sort({ saleDate: -1 }).limit(10);
    
    console.log("\n📊 Últimas 10 ventas:");
    allSales.forEach((sale, i) => {
      console.log(`${i + 1}. Fecha: ${sale.saleDate.toISOString().split('T')[0]} | Estado: ${sale.paymentStatus} | Admin: ${sale.distributor ? 'No' : 'Sí'} | Total: $${sale.salePrice * sale.quantity}`);
    });

    // Ventas del mes actual
    const currentMonthSales = await Sale.find({
      saleDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    console.log(`\n✅ Ventas del mes actual (${now.toLocaleString('es-ES', { month: 'long' })}): ${currentMonthSales.length}`);
    console.log(`   Confirmadas: ${currentMonthSales.filter(s => s.paymentStatus === 'confirmado').length}`);
    console.log(`   Pendientes: ${currentMonthSales.filter(s => s.paymentStatus === 'pendiente').length}`);

    // Ventas admin
    const adminSales = await Sale.find({ distributor: null });
    console.log(`\n👤 Total ventas admin: ${adminSales.length}`);
    adminSales.slice(0, 5).forEach((sale, i) => {
      console.log(`   ${i + 1}. Fecha: ${sale.saleDate.toISOString().split('T')[0]} | Estado: ${sale.paymentStatus}`);
    });

    mongoose.disconnect();
    console.log("\n✅ Script completado");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkSalesDates();
