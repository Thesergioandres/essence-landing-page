import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import dotenv from "dotenv";

dotenv.config();

// ⚠️ CAMBIAR A false PARA EJECUTAR LA ACTUALIZACIÓN
const DRY_RUN = true;

const recalculateSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    console.log('='.repeat(100));
    console.log(DRY_RUN ? '👁️  MODO PREVIEW - NO SE GUARDARÁ NADA' : '🚀 MODO ACTUALIZACIÓN - SE GUARDARÁ EN LA BD');
    console.log('='.repeat(100));
    console.log();

    const sales = await Sale.find({ paymentStatus: 'confirmado' }).sort({ createdAt: 1 });
    console.log(`📊 Total de ventas confirmadas: ${sales.length}\n`);

    const changes = [];

    for (const sale of sales) {
      const oldAdminProfit = sale.adminProfit;
      const oldDistributorProfit = sale.distributorProfit;
      const oldDistributorPrice = sale.distributorPrice;

      let newAdminProfit, newDistributorProfit, newDistributorPrice;

      if (!sale.distributor) {
        // Venta Admin
        newAdminProfit = (sale.salePrice - sale.purchasePrice) * sale.quantity;
        newDistributorProfit = 0;
        newDistributorPrice = 0;
      } else {
        // Venta de distribuidor - NUEVA FÓRMULA
        const profitPercentage = sale.distributorProfitPercentage || 20;
        
        // Precio para distribuidor = Lo que el distribuidor PAGA al admin
        newDistributorPrice = sale.salePrice * ((100 - profitPercentage) / 100);
        
        // Ganancia del distribuidor = Precio Venta - Precio que paga al admin
        newDistributorProfit = (sale.salePrice - newDistributorPrice) * sale.quantity;
        
        // Ganancia del admin = Precio Venta - Precio Compra - Ganancia Distribuidor
        newAdminProfit = (sale.salePrice - sale.purchasePrice - (sale.salePrice - newDistributorPrice)) * sale.quantity;
      }

      const adminDiff = Math.abs(oldAdminProfit - newAdminProfit);
      const distDiff = Math.abs(oldDistributorProfit - newDistributorProfit);
      const priceDiff = Math.abs((oldDistributorPrice || 0) - (newDistributorPrice || 0));

      if (adminDiff > 0.01 || distDiff > 0.01 || priceDiff > 0.01) {
        changes.push({
          sale,
          old: { admin: oldAdminProfit, dist: oldDistributorProfit, price: oldDistributorPrice },
          new: { admin: newAdminProfit, dist: newDistributorProfit, price: newDistributorPrice },
          diff: { 
            admin: newAdminProfit - oldAdminProfit, 
            dist: newDistributorProfit - oldDistributorProfit,
            price: (newDistributorPrice || 0) - (oldDistributorPrice || 0)
          }
        });
      }
    }

    if (changes.length === 0) {
      console.log('✅ ¡Todas las ventas están correctas! No hay nada que actualizar.\n');
      await mongoose.connection.close();
      return;
    }

    console.log(`${'-'.repeat(100)}`);
    console.log(`🔍 VENTAS QUE NECESITAN RECALCULARSE: ${changes.length} de ${sales.length}`);
    console.log(`${'-'.repeat(100)}\n`);

    changes.forEach((item, i) => {
      const { sale, old, new: newVals, diff } = item;
      
      console.log(`${i + 1}. Venta ID: ${sale._id}`);
      console.log(`   Fecha: ${sale.saleDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`   Precio Venta: $${sale.salePrice.toLocaleString('es-CO')} x ${sale.quantity}`);
      console.log(`   Comisión: ${sale.distributorProfitPercentage || 20}%`);
      console.log(`
   VALORES ACTUALES (INCORRECTOS):
     Precio Distribuidor:  $${(old.price || 0).toLocaleString('es-CO')}
     Admin Profit:         $${old.admin.toLocaleString('es-CO')}
     Distributor Profit:   $${old.dist.toLocaleString('es-CO')}
   
   VALORES CORRECTOS (NUEVOS):
     Precio Distribuidor:  $${(newVals.price || 0).toLocaleString('es-CO')} (${diff.price >= 0 ? '+' : ''}$${diff.price.toLocaleString('es-CO')})
     Admin Profit:         $${newVals.admin.toLocaleString('es-CO')} (${diff.admin >= 0 ? '+' : ''}$${diff.admin.toLocaleString('es-CO')})
     Distributor Profit:   $${newVals.dist.toLocaleString('es-CO')} (${diff.dist >= 0 ? '+' : ''}$${diff.dist.toLocaleString('es-CO')})
`);
    });

    const totalAdminDiff = changes.reduce((sum, c) => sum + c.diff.admin, 0);
    const totalDistDiff = changes.reduce((sum, c) => sum + c.diff.dist, 0);

    console.log(`${'='.repeat(100)}`);
    console.log(`💰 IMPACTO TOTAL:`);
    console.log(`${'='.repeat(100)}`);
    console.log(`Admin Profit:       ${totalAdminDiff >= 0 ? '+' : ''}$${totalAdminDiff.toLocaleString('es-CO')}`);
    console.log(`Distributor Profit: ${totalDistDiff >= 0 ? '+' : ''}$${totalDistDiff.toLocaleString('es-CO')}`);
    console.log(`${'='.repeat(100)}\n`);

    if (!DRY_RUN) {
      console.log('🚀 Actualizando ventas...\n');
      
      for (const item of changes) {
        await Sale.updateOne(
          { _id: item.sale._id },
          { 
            $set: { 
              distributorPrice: item.new.price,
              adminProfit: item.new.admin,
              distributorProfit: item.new.dist,
              totalProfit: item.new.admin + item.new.dist
            } 
          }
        );
        console.log(`✅ Venta ${item.sale._id} actualizada`);
      }
      
      console.log('\n✅ Todas las ventas actualizadas correctamente\n');
    } else {
      console.log('⚠️  MODO PREVIEW ACTIVADO - No se guardó nada');
      console.log('⚠️  Para ejecutar, cambia DRY_RUN = false\n');
    }

    await mongoose.connection.close();
    console.log('✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

recalculateSales();
