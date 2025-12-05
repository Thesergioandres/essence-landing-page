import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const investigateIncorrectSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    console.log('='.repeat(100));
    console.log('🔍 INVESTIGANDO VENTAS CON CÁLCULOS INCORRECTOS');
    console.log('='.repeat(100));

    const sales = await Sale.find({ paymentStatus: 'confirmado' })
      .populate('product', 'name')
      .populate('distributor', 'name email')
      .skip(10) // Saltar las 10 más recientes
      .limit(10)
      .sort({ createdAt: -1 });

    console.log(`\nAnalizando ${sales.length} ventas...\n`);

    let incorrectCount = 0;
    let correctCount = 0;

    sales.forEach((sale, index) => {
      console.log(`${'-'.repeat(100)}`);
      console.log(`VENTA ${index + 1}: ${sale.product?.name || 'N/A'}`);
      console.log(`${'-'.repeat(100)}`);
      console.log(`ID: ${sale._id}`);
      console.log(`Fecha: ${sale.saleDate.toISOString()}`);
      console.log(`Distribuidor: ${sale.distributor?.name || 'VENTA ADMIN'}`);
      console.log(`Email: ${sale.distributor?.email || 'N/A'}`);
      console.log('');
      
      console.log('📝 DATOS DE LA VENTA:');
      console.log(`  Precio de compra: $${sale.purchasePrice.toLocaleString('es-CO')}`);
      console.log(`  Precio distribuidor: $${sale.distributorPrice.toLocaleString('es-CO')}`);
      console.log(`  Precio de venta: $${sale.salePrice.toLocaleString('es-CO')}`);
      console.log(`  Cantidad: ${sale.quantity}`);
      console.log(`  Porcentaje distribuidor: ${sale.distributorProfitPercentage}%`);
      console.log('');

      console.log('💰 GANANCIAS GUARDADAS EN BD:');
      console.log(`  Admin Profit: $${sale.adminProfit.toLocaleString('es-CO')}`);
      console.log(`  Distributor Profit: $${sale.distributorProfit.toLocaleString('es-CO')}`);
      console.log(`  Total Profit: $${sale.totalProfit.toLocaleString('es-CO')}`);
      console.log('');

      // Recalcular según la fórmula actual
      let calculatedDistProfit = 0;
      let calculatedAdminProfit = 0;
      let calculatedTotalProfit = 0;

      if (sale.distributor) {
        // Venta con distribuidor
        const profitPercentage = sale.distributorProfitPercentage || 20;
        calculatedDistProfit = (sale.salePrice * profitPercentage / 100) * sale.quantity;
        calculatedAdminProfit = ((sale.salePrice - (sale.salePrice * profitPercentage / 100) - sale.purchasePrice) * sale.quantity);
        calculatedTotalProfit = calculatedDistProfit + calculatedAdminProfit;
      } else {
        // Venta admin sin distribuidor
        calculatedAdminProfit = (sale.salePrice - sale.purchasePrice) * sale.quantity;
        calculatedDistProfit = 0;
        calculatedTotalProfit = calculatedAdminProfit;
      }

      console.log('🔢 CÁLCULOS ESPERADOS (FÓRMULA ACTUAL):');
      console.log(`  Admin Profit: $${calculatedAdminProfit.toLocaleString('es-CO')}`);
      console.log(`  Distributor Profit: $${calculatedDistProfit.toLocaleString('es-CO')}`);
      console.log(`  Total Profit: $${calculatedTotalProfit.toLocaleString('es-CO')}`);
      console.log('');

      // Comparar
      const adminDiff = Math.abs(sale.adminProfit - calculatedAdminProfit);
      const distDiff = Math.abs(sale.distributorProfit - calculatedDistProfit);
      const totalDiff = Math.abs(sale.totalProfit - calculatedTotalProfit);
      const tolerance = 0.01;

      const isCorrect = adminDiff <= tolerance && distDiff <= tolerance && totalDiff <= tolerance;

      if (isCorrect) {
        console.log('✅ CÁLCULO CORRECTO');
        correctCount++;
      } else {
        console.log('❌ CÁLCULO INCORRECTO - DIFERENCIAS:');
        if (adminDiff > tolerance) {
          console.log(`  ⚠️  Admin Profit: diferencia de $${adminDiff.toLocaleString('es-CO')}`);
        }
        if (distDiff > tolerance) {
          console.log(`  ⚠️  Distributor Profit: diferencia de $${distDiff.toLocaleString('es-CO')}`);
        }
        if (totalDiff > tolerance) {
          console.log(`  ⚠️  Total Profit: diferencia de $${totalDiff.toLocaleString('es-CO')}`);
        }
        console.log('');
        console.log('🔎 POSIBLES CAUSAS:');
        
        // Analizar posibles causas
        const causes = [];
        
        // ¿Porcentaje diferente al estándar 20%?
        if (sale.distributorProfitPercentage !== 20 && sale.distributor) {
          causes.push(`Porcentaje especial: ${sale.distributorProfitPercentage}% (ranking o bonificación)`);
        }
        
        // ¿La ganancia del distribuidor coincide con distributorPrice?
        if (sale.distributor) {
          const distProfitFromPrice = (sale.distributorPrice - sale.purchasePrice) * sale.quantity;
          if (Math.abs(sale.distributorProfit - distProfitFromPrice) < tolerance) {
            causes.push('Usa fórmula antigua: distributorProfit = (distributorPrice - purchasePrice) * quantity');
          }
        }
        
        // ¿Suma correcta de componentes?
        if (Math.abs(sale.totalProfit - (sale.adminProfit + sale.distributorProfit)) > tolerance) {
          causes.push('totalProfit no es la suma de adminProfit + distributorProfit');
        }
        
        // ¿Coincide con precio de venta menos costo total?
        const totalRevenue = sale.salePrice * sale.quantity;
        const totalCost = sale.purchasePrice * sale.quantity;
        const profitFromRevenueCost = totalRevenue - totalCost;
        if (Math.abs(sale.totalProfit - profitFromRevenueCost) < tolerance) {
          causes.push('Usa fórmula simplificada: totalProfit = (salePrice - purchasePrice) * quantity');
        }
        
        if (causes.length > 0) {
          causes.forEach(cause => console.log(`  • ${cause}`));
        } else {
          console.log('  • Causa desconocida - requiere revisión manual');
        }
        
        incorrectCount++;
      }
      console.log('');
    });

    console.log('='.repeat(100));
    console.log('📊 RESUMEN DEL ANÁLISIS');
    console.log('='.repeat(100));
    console.log(`✅ Ventas correctas: ${correctCount} de ${sales.length}`);
    console.log(`❌ Ventas incorrectas: ${incorrectCount} de ${sales.length}`);
    console.log(`Porcentaje de éxito: ${((correctCount / sales.length) * 100).toFixed(2)}%`);
    console.log('='.repeat(100));

    if (incorrectCount > 0) {
      console.log('\n💡 RECOMENDACIÓN:');
      console.log('Las ventas con cálculos incorrectos probablemente se crearon antes de que');
      console.log('se actualizara la fórmula de cálculo de ganancias. Las ventas nuevas deberían');
      console.log('calcularse correctamente automáticamente.\n');
      console.log('Opciones:');
      console.log('1. Recalcular todas las ventas antiguas (puede afectar reportes históricos)');
      console.log('2. Dejar las ventas antiguas como están y asegurar que las nuevas sean correctas');
      console.log('3. Marcar las ventas incorrectas para revisión manual');
    }

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

investigateIncorrectSales();
