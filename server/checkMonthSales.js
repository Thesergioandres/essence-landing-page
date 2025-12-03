import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import User from './models/User.js';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import dotenv from 'dotenv';

dotenv.config();

const checkMonthSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const now = new Date();
    const colombiaOffset = -5 * 60;
    const colombiaTime = new Date(now.getTime() + colombiaOffset * 60000);
    
    const thisMonthStart = startOfMonth(colombiaTime);
    const lastMonthStart = startOfMonth(subMonths(colombiaTime, 1));
    const lastMonthEnd = endOfMonth(subMonths(colombiaTime, 1));

    console.log('Fechas de consulta:');
    console.log('Mes actual desde:', thisMonthStart.toISOString());
    console.log('Mes anterior:', lastMonthStart.toISOString(), 'hasta', lastMonthEnd.toISOString());
    console.log('');

    // Ventas del mes actual
    const thisMonthSales = await Sale.find({
      saleDate: { $gte: thisMonthStart },
      paymentStatus: 'confirmado'
    }).populate('product', 'name');

    // Ventas del mes anterior
    const lastMonthSales = await Sale.find({
      saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
      paymentStatus: 'confirmado'
    }).populate('product', 'name');

    console.log(`📊 VENTAS MES ACTUAL (desde ${thisMonthStart.toISOString()}): ${thisMonthSales.length}`);
    let thisMonthRevenue = 0;
    let thisMonthProfit = 0;
    thisMonthSales.forEach((sale, i) => {
      const revenue = sale.salePrice * sale.quantity;
      thisMonthRevenue += revenue;
      thisMonthProfit += sale.totalProfit;
      console.log(`${i+1}. ${sale.product?.name} - $${revenue.toLocaleString('es-CO')} - Ganancia: $${sale.totalProfit.toLocaleString('es-CO')} - ${sale.saleDate.toISOString()}`);
    });

    console.log('\n' + '='.repeat(100));
    console.log(`📊 VENTAS MES ANTERIOR: ${lastMonthSales.length}`);
    let lastMonthRevenue = 0;
    let lastMonthProfit = 0;
    lastMonthSales.forEach((sale, i) => {
      const revenue = sale.salePrice * sale.quantity;
      lastMonthRevenue += revenue;
      lastMonthProfit += sale.totalProfit;
      console.log(`${i+1}. ${sale.product?.name} - $${revenue.toLocaleString('es-CO')} - Ganancia: $${sale.totalProfit.toLocaleString('es-CO')} - ${sale.saleDate.toISOString()}`);
    });

    console.log('\n' + '='.repeat(100));
    console.log('RESUMEN:');
    console.log(`Mes Actual: ${thisMonthSales.length} ventas - $${thisMonthRevenue.toLocaleString('es-CO')} ingresos - $${thisMonthProfit.toLocaleString('es-CO')} ganancia`);
    console.log(`Mes Anterior: ${lastMonthSales.length} ventas - $${lastMonthRevenue.toLocaleString('es-CO')} ingresos - $${lastMonthProfit.toLocaleString('es-CO')} ganancia`);

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkMonthSales();
