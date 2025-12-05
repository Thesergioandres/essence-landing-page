import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const testFilters = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Simular filtro del frontend: "2025-12-02" (hoy)
    const startDateString = "2025-12-02";
    const endDateString = "2025-12-02";

    // Forma ANTIGUA (incorrecta)
    console.log('='.repeat(100));
    console.log('❌ FILTRO ANTIGUO (sin ajuste de zona horaria):');
    console.log('='.repeat(100));
    const oldStartDate = new Date(startDateString);
    const oldEndDate = new Date(endDateString);
    console.log('startDate:', oldStartDate.toISOString());
    console.log('endDate:', oldEndDate.toISOString());
    
    const oldSales = await Sale.find({
      saleDate: { $gte: oldStartDate, $lte: oldEndDate },
      paymentStatus: 'confirmado'
    }).populate('product', 'name');
    
    console.log(`\nResultado: ${oldSales.length} ventas encontradas`);
    oldSales.forEach((sale, i) => {
      console.log(`${i+1}. ${sale.product?.name} - $${(sale.salePrice * sale.quantity).toLocaleString('es-CO')} - ${sale.saleDate.toISOString()}`);
    });

    // Forma NUEVA (correcta con ajuste Colombia)
    console.log('\n' + '='.repeat(100));
    console.log('✅ FILTRO NUEVO (con ajuste Colombia UTC-5):');
    console.log('='.repeat(100));
    
    const startDate = new Date(startDateString);
    const newStartDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 5, 0, 0));
    
    const endDate = new Date(endDateString);
    const newEndDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1, 4, 59, 59, 999));
    
    console.log('startDate (00:00 Colombia = 05:00 UTC):', newStartDate.toISOString());
    console.log('endDate (23:59:59 Colombia = 04:59:59 UTC del día siguiente):', newEndDate.toISOString());
    
    const newSales = await Sale.find({
      saleDate: { $gte: newStartDate, $lte: newEndDate },
      paymentStatus: 'confirmado'
    }).populate('product', 'name').populate('distributor', 'name');
    
    console.log(`\nResultado: ${newSales.length} ventas encontradas`);
    let totalRevenue = 0;
    let totalProfit = 0;
    
    newSales.forEach((sale, i) => {
      const revenue = sale.salePrice * sale.quantity;
      totalRevenue += revenue;
      totalProfit += sale.totalProfit;
      console.log(`${i+1}. ${sale.product?.name} - $${revenue.toLocaleString('es-CO')} - Ganancia: $${sale.totalProfit.toLocaleString('es-CO')} - ${sale.saleDate.toISOString()}`);
      console.log(`   Distribuidor: ${sale.distributor?.name || 'Admin'}`);
    });

    console.log('\n' + '='.repeat(100));
    console.log('RESUMEN DEL FILTRO (2 dic 2025):');
    console.log('='.repeat(100));
    console.log(`Ventas: ${newSales.length}`);
    console.log(`Ingresos totales: $${totalRevenue.toLocaleString('es-CO')}`);
    console.log(`Ganancia total: $${totalProfit.toLocaleString('es-CO')}`);
    console.log('='.repeat(100));

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testFilters();
