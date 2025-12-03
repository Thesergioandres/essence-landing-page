import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import dotenv from 'dotenv';

dotenv.config();

const verifyCalculations = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Obtener todas las ventas confirmadas
    const sales = await Sale.find({ paymentStatus: 'confirmado' })
      .populate('product', 'name')
      .populate('distributor', 'name email')
      .sort({ createdAt: -1 });

    console.log(`📊 Total ventas confirmadas: ${sales.length}\n`);

    let totalRevenue = 0;
    let totalAdminProfit = 0;
    let totalDistributorProfit = 0;
    let totalProfit = 0;

    console.log('='.repeat(120));
    console.log('DETALLE DE VENTAS:');
    console.log('='.repeat(120));

    sales.forEach((sale, index) => {
      const revenue = sale.salePrice * sale.quantity;
      totalRevenue += revenue;
      totalAdminProfit += sale.adminProfit;
      totalDistributorProfit += sale.distributorProfit;
      totalProfit += sale.totalProfit;

      console.log(`\n${index + 1}. Producto: ${sale.product?.name || 'N/A'}`);
      console.log(`   Distribuidor: ${sale.distributor?.name || 'Venta Admin'} (${sale.distributor?.email || 'N/A'})`);
      console.log(`   Fecha: ${new Date(sale.createdAt).toLocaleString('es-CO')}`);
      console.log(`   Cantidad: ${sale.quantity}`);
      console.log(`   Precio unitario: $${sale.salePrice.toLocaleString('es-CO')}`);
      console.log(`   Precio compra: $${sale.purchasePrice.toLocaleString('es-CO')}`);
      console.log(`   📈 Revenue (Total Venta): $${revenue.toLocaleString('es-CO')}`);
      console.log(`   💰 Ganancia Admin: $${sale.adminProfit.toLocaleString('es-CO')}`);
      console.log(`   💵 Ganancia Distribuidor: $${sale.distributorProfit.toLocaleString('es-CO')}`);
      console.log(`   💎 Ganancia Total: $${sale.totalProfit.toLocaleString('es-CO')}`);
      console.log(`   Estado: ${sale.paymentStatus}`);
      
      // Verificar cálculos
      const expectedTotalProfit = sale.adminProfit + sale.distributorProfit;
      if (Math.abs(sale.totalProfit - expectedTotalProfit) > 0.01) {
        console.log(`   ⚠️  ERROR: totalProfit (${sale.totalProfit}) != adminProfit + distributorProfit (${expectedTotalProfit})`);
      }
      
      // Verificar que adminProfit + distributorProfit + purchasePrice * quantity = revenue
      const expectedRevenue = sale.adminProfit + sale.distributorProfit + (sale.purchasePrice * sale.quantity);
      if (Math.abs(revenue - expectedRevenue) > 0.01) {
        console.log(`   ⚠️  ERROR: Revenue (${revenue}) != adminProfit + distributorProfit + cost (${expectedRevenue})`);
        console.log(`   Detalle: ${sale.adminProfit} + ${sale.distributorProfit} + ${sale.purchasePrice * sale.quantity} = ${expectedRevenue}`);
      }
    });

    console.log('\n' + '='.repeat(120));
    console.log('RESUMEN TOTALES:');
    console.log('='.repeat(120));
    console.log(`📊 Total Revenue (Ventas): $${totalRevenue.toLocaleString('es-CO')}`);
    console.log(`💰 Total Ganancia Admin: $${totalAdminProfit.toLocaleString('es-CO')}`);
    console.log(`💵 Total Ganancia Distribuidores: $${totalDistributorProfit.toLocaleString('es-CO')}`);
    console.log(`💎 Total Ganancia General: $${totalProfit.toLocaleString('es-CO')}`);
    console.log('='.repeat(120));

    // Verificar suma
    const calculatedTotalProfit = totalAdminProfit + totalDistributorProfit;
    if (Math.abs(totalProfit - calculatedTotalProfit) > 0.01) {
      console.log(`\n⚠️  ERROR EN SUMA: totalProfit (${totalProfit}) != suma de ganancias (${calculatedTotalProfit})`);
    } else {
      console.log(`\n✅ Los totales coinciden correctamente`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

verifyCalculations();
