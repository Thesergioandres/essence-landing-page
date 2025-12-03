import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const checkTodaySales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Obtener ventas de hoy
    const now = new Date();
    console.log('Servidor UTC:', now.toISOString());
    
    // Colombia time
    const colombiaOffset = -5 * 60;
    const colombiaTime = new Date(now.getTime() + colombiaOffset * 60000);
    console.log('Colombia Time:', colombiaTime.toISOString());
    
    // Start of today in Colombia
    const startOfTodayColombia = new Date(colombiaTime.getFullYear(), colombiaTime.getMonth(), colombiaTime.getDate(), 0, 0, 0);
    console.log('Start of Today Colombia:', startOfTodayColombia.toISOString());
    
    const todaySales = await Sale.find({ 
      paymentStatus: 'confirmado',
      saleDate: { $gte: startOfTodayColombia }
    })
    .populate('product', 'name')
    .populate('distributor', 'name email')
    .sort({ saleDate: -1 });

    console.log(`\n📊 Ventas de hoy (desde ${startOfTodayColombia.toISOString()}): ${todaySales.length}\n`);

    todaySales.forEach((sale, index) => {
      console.log(`${index + 1}. Producto: ${sale.product?.name}`);
      console.log(`   Distribuidor: ${sale.distributor?.name || 'Admin'}`);
      console.log(`   saleDate: ${sale.saleDate.toISOString()}`);
      console.log(`   createdAt: ${sale.createdAt.toISOString()}`);
      console.log(`   purchasePrice: $${sale.purchasePrice.toLocaleString('es-CO')}`);
      console.log(`   distributorPrice: $${sale.distributorPrice.toLocaleString('es-CO')}`);
      console.log(`   salePrice: $${sale.salePrice.toLocaleString('es-CO')}`);
      console.log(`   Cantidad: ${sale.quantity}`);
      console.log(`   Total Venta: $${(sale.salePrice * sale.quantity).toLocaleString('es-CO')}`);
      console.log(`   💰 Admin Profit: $${sale.adminProfit.toLocaleString('es-CO')}`);
      console.log(`   💵 Distributor Profit: $${sale.distributorProfit.toLocaleString('es-CO')}`);
      console.log(`   💎 Total Profit: $${sale.totalProfit.toLocaleString('es-CO')}`);
      console.log(`   📊 Distributor %: ${sale.distributorProfitPercentage}%`);
      console.log('');
    });

    // También buscar todas las ventas confirmadas recientes
    console.log('\n📋 Últimas 5 ventas confirmadas:');
    const recentSales = await Sale.find({ paymentStatus: 'confirmado' })
      .populate('product', 'name')
      .sort({ saleDate: -1 })
      .limit(5);

    recentSales.forEach((sale, index) => {
      console.log(`${index + 1}. ${sale.product?.name} - saleDate: ${sale.saleDate.toISOString()}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkTodaySales();
