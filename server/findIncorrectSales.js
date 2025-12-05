import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const findAllIncorrectSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    console.log('='.repeat(100));
    console.log('🔍 BUSCANDO TODAS LAS VENTAS CON CÁLCULOS INCORRECTOS');
    console.log('='.repeat(100));

    const allSales = await Sale.find({ paymentStatus: 'confirmado' })
      .populate('product', 'name')
      .populate('distributor', 'name')
      .sort({ createdAt: 1 }); // Más antiguas primero

    console.log(`\nAnalizando ${allSales.length} ventas confirmadas...\n`);

    const incorrectSales = [];
    const tolerance = 0.01;

    allSales.forEach(sale => {
      let calculatedDistProfit = 0;
      let calculatedAdminProfit = 0;

      if (sale.distributor) {
        const profitPercentage = sale.distributorProfitPercentage || 20;
        calculatedDistProfit = (sale.salePrice * profitPercentage / 100) * sale.quantity;
        calculatedAdminProfit = ((sale.salePrice - (sale.salePrice * profitPercentage / 100) - sale.purchasePrice) * sale.quantity);
      } else {
        calculatedAdminProfit = (sale.salePrice - sale.purchasePrice) * sale.quantity;
        calculatedDistProfit = 0;
      }

      const adminDiff = Math.abs(sale.adminProfit - calculatedAdminProfit);
      const distDiff = Math.abs(sale.distributorProfit - calculatedDistProfit);

      if (adminDiff > tolerance || distDiff > tolerance) {
        incorrectSales.push({
          _id: sale._id,
          product: sale.product?.name || 'N/A',
          distributor: sale.distributor?.name || 'ADMIN',
          date: sale.saleDate,
          salePrice: sale.salePrice,
          quantity: sale.quantity,
          purchasePrice: sale.purchasePrice,
          distributorPrice: sale.distributorPrice,
          percentage: sale.distributorProfitPercentage,
          adminProfit: sale.adminProfit,
          distributorProfit: sale.distributorProfit,
          totalProfit: sale.totalProfit,
          expectedAdmin: calculatedAdminProfit,
          expectedDist: calculatedDistProfit,
          adminDiff,
          distDiff
        });
      }
    });

    console.log(`${'-'.repeat(100)}`);
    console.log(`📊 RESULTADO:`);
    console.log(`${'-'.repeat(100)}`);
    console.log(`✅ Ventas correctas: ${allSales.length - incorrectSales.length} de ${allSales.length} (${((allSales.length - incorrectSales.length) / allSales.length * 100).toFixed(2)}%)`);
    console.log(`❌ Ventas incorrectas: ${incorrectSales.length} de ${allSales.length} (${(incorrectSales.length / allSales.length * 100).toFixed(2)}%)`);
    console.log(`${'-'.repeat(100)}\n`);

    if (incorrectSales.length > 0) {
      console.log('❌ VENTAS CON CÁLCULOS INCORRECTOS:\n');
      incorrectSales.forEach((sale, i) => {
        console.log(`${i + 1}. ID: ${sale._id}`);
        console.log(`   Producto: ${sale.product}`);
        console.log(`   Distribuidor: ${sale.distributor}`);
        console.log(`   Fecha: ${sale.date.toISOString().split('T')[0]}`);
        console.log(`   Precio venta: $${sale.salePrice.toLocaleString('es-CO')} x ${sale.quantity}`);
        console.log(`   Admin Profit: $${sale.adminProfit.toLocaleString('es-CO')} → debería ser $${sale.expectedAdmin.toLocaleString('es-CO')} (diff: $${sale.adminDiff.toLocaleString('es-CO')})`);
        console.log(`   Dist Profit: $${sale.distributorProfit.toLocaleString('es-CO')} → debería ser $${sale.expectedDist.toLocaleString('es-CO')} (diff: $${sale.distDiff.toLocaleString('es-CO')})`);
        console.log('');
      });

      console.log('='.repeat(100));
      console.log('💡 ANÁLISIS:');
      console.log('='.repeat(100));
      
      // Agrupar por tipo de error
      const withDistributor = incorrectSales.filter(s => s.distributor !== 'ADMIN');
      const adminSales = incorrectSales.filter(s => s.distributor === 'ADMIN');
      
      console.log(`\n📊 Ventas con distribuidor incorrectas: ${withDistributor.length}`);
      console.log(`📊 Ventas admin incorrectas: ${adminSales.length}`);
      
      // Fechas
      const dates = incorrectSales.map(s => s.date);
      const oldest = new Date(Math.min(...dates));
      const newest = new Date(Math.max(...dates));
      console.log(`\n📅 Rango de fechas: ${oldest.toISOString().split('T')[0]} a ${newest.toISOString().split('T')[0]}`);
      
      // Impacto financiero
      const totalAdminDiff = incorrectSales.reduce((sum, s) => sum + s.adminDiff, 0);
      const totalDistDiff = incorrectSales.reduce((sum, s) => sum + s.distDiff, 0);
      console.log(`\n💰 Impacto total:`);
      console.log(`   Admin Profit: $${totalAdminDiff.toLocaleString('es-CO')} de diferencia`);
      console.log(`   Dist Profit: $${totalDistDiff.toLocaleString('es-CO')} de diferencia`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

findAllIncorrectSales();
