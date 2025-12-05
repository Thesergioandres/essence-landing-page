import mongoose from 'mongoose';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const checkPercentages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const sales = await Sale.find({ paymentStatus: 'confirmado' })
      .populate('product', 'name')
      .populate('distributor', 'name')
      .sort({ createdAt: -1 });

    console.log('='.repeat(100));
    console.log('📊 VERIFICACIÓN DE PORCENTAJES Y CÁLCULOS');
    console.log('='.repeat(100));
    console.log();

    const groupedByPercentage = {
      admin: [],
      '20': [],
      '21': [],
      '23': [],
      '25': [],
      other: []
    };

    sales.forEach(sale => {
      if (!sale.distributor) {
        groupedByPercentage.admin.push(sale);
      } else {
        const pct = sale.distributorProfitPercentage || 20;
        const key = pct.toString();
        if (groupedByPercentage[key]) {
          groupedByPercentage[key].push(sale);
        } else {
          groupedByPercentage.other.push(sale);
        }
      }
    });

    // Mostrar resumen
    console.log('📊 RESUMEN POR TIPO:');
    console.log('-'.repeat(100));
    console.log(`Ventas ADMIN (100% ganancia):    ${groupedByPercentage.admin.length} ventas`);
    console.log(`Ventas Dist 20% (ranking normal): ${groupedByPercentage['20'].length} ventas`);
    console.log(`Ventas Dist 21% (🥉 3er lugar):   ${groupedByPercentage['21'].length} ventas`);
    console.log(`Ventas Dist 23% (🥈 2do lugar):   ${groupedByPercentage['23'].length} ventas`);
    console.log(`Ventas Dist 25% (🥇 1er lugar):   ${groupedByPercentage['25'].length} ventas`);
    if (groupedByPercentage.other.length > 0) {
      console.log(`Ventas con % diferente:           ${groupedByPercentage.other.length} ventas`);
    }
    console.log();

    // Mostrar ejemplos de cada tipo
    console.log('='.repeat(100));
    console.log('📝 EJEMPLOS DE CADA TIPO:');
    console.log('='.repeat(100));
    console.log();

    // Ejemplo ADMIN
    if (groupedByPercentage.admin.length > 0) {
      const sale = groupedByPercentage.admin[0];
      console.log('🏢 EJEMPLO VENTA ADMIN:');
      console.log(`   Producto: ${sale.product?.name || 'N/A'}`);
      console.log(`   Fecha: ${sale.saleDate.toISOString().split('T')[0]}`);
      console.log(`   Precio venta: $${sale.salePrice.toLocaleString('es-CO')} x ${sale.quantity}`);
      console.log(`   Precio compra: $${sale.purchasePrice.toLocaleString('es-CO')}`);
      console.log(`   
   CÁLCULO:
     Admin Profit (BD):  $${sale.adminProfit.toLocaleString('es-CO')}
     Esperado:           $${((sale.salePrice - sale.purchasePrice) * sale.quantity).toLocaleString('es-CO')}
     ¿Correcto?: ${Math.abs(sale.adminProfit - ((sale.salePrice - sale.purchasePrice) * sale.quantity)) < 0.01 ? '✅' : '❌'}
     
     Dist Profit (BD):   $${sale.distributorProfit.toLocaleString('es-CO')}
     Esperado:           $0
     ¿Correcto?: ${sale.distributorProfit === 0 ? '✅' : '❌'}
`);
    }

    // Ejemplo 20%
    if (groupedByPercentage['20'].length > 0) {
      const sale = groupedByPercentage['20'][0];
      const expectedDist = (sale.salePrice * 20 / 100) * sale.quantity;
      const expectedAdmin = ((sale.salePrice - (sale.salePrice * 20 / 100) - sale.purchasePrice) * sale.quantity);
      
      console.log('👤 EJEMPLO VENTA DISTRIBUIDOR 20%:');
      console.log(`   Distribuidor: ${sale.distributor?.name || 'N/A'}`);
      console.log(`   Producto: ${sale.product?.name || 'N/A'}`);
      console.log(`   Fecha: ${sale.saleDate.toISOString().split('T')[0]}`);
      console.log(`   Precio venta: $${sale.salePrice.toLocaleString('es-CO')} x ${sale.quantity}`);
      console.log(`   Precio compra: $${sale.purchasePrice.toLocaleString('es-CO')}`);
      console.log(`   
   CÁLCULO:
     Dist Profit (BD):   $${sale.distributorProfit.toLocaleString('es-CO')}
     Esperado (20%):     $${expectedDist.toLocaleString('es-CO')}
     ¿Correcto?: ${Math.abs(sale.distributorProfit - expectedDist) < 0.01 ? '✅' : '❌'}
     
     Admin Profit (BD):  $${sale.adminProfit.toLocaleString('es-CO')}
     Esperado:           $${expectedAdmin.toLocaleString('es-CO')}
     ¿Correcto?: ${Math.abs(sale.adminProfit - expectedAdmin) < 0.01 ? '✅' : '❌'}
`);
    }

    // Ejemplo 25%
    if (groupedByPercentage['25'].length > 0) {
      const sale = groupedByPercentage['25'][0];
      const expectedDist = (sale.salePrice * 25 / 100) * sale.quantity;
      const expectedAdmin = ((sale.salePrice - (sale.salePrice * 25 / 100) - sale.purchasePrice) * sale.quantity);
      
      console.log('🥇 EJEMPLO VENTA DISTRIBUIDOR 25% (1ER LUGAR):');
      console.log(`   Distribuidor: ${sale.distributor?.name || 'N/A'}`);
      console.log(`   Producto: ${sale.product?.name || 'N/A'}`);
      console.log(`   Fecha: ${sale.saleDate.toISOString().split('T')[0]}`);
      console.log(`   Precio venta: $${sale.salePrice.toLocaleString('es-CO')} x ${sale.quantity}`);
      console.log(`   Precio compra: $${sale.purchasePrice.toLocaleString('es-CO')}`);
      console.log(`   
   CÁLCULO:
     Dist Profit (BD):   $${sale.distributorProfit.toLocaleString('es-CO')}
     Esperado (25%):     $${expectedDist.toLocaleString('es-CO')}
     ¿Correcto?: ${Math.abs(sale.distributorProfit - expectedDist) < 0.01 ? '✅' : '❌'}
     
     Admin Profit (BD):  $${sale.adminProfit.toLocaleString('es-CO')}
     Esperado:           $${expectedAdmin.toLocaleString('es-CO')}
     ¿Correcto?: ${Math.abs(sale.adminProfit - expectedAdmin) < 0.01 ? '✅' : '❌'}
`);
    }

    console.log('='.repeat(100));
    console.log('✅ Verificación completada');
    console.log('='.repeat(100));

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkPercentages();
