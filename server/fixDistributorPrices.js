import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = true; // Cambiar a false para ejecutar actualización

const fixDistributorPrices = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    console.log('='.repeat(100));
    console.log(DRY_RUN ? '👁️  MODO PREVIEW - NO SE GUARDARÁ NADA' : '🚀 MODO ACTUALIZACIÓN - SE GUARDARÁ EN LA BD');
    console.log('='.repeat(100));
    console.log();

    // Obtener todos los productos con distributorCommission > 0
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const products = await Product.find({ distributorCommission: { $gt: 0 } });
    
    console.log(`📦 Total de productos con comisión de distribuidor: ${products.length}\n`);

    const updates = [];

    for (const product of products) {
      const oldDistributorPrice = product.distributorPrice;
      const commission = product.distributorCommission;
      
      // FÓRMULA CORRECTA: Precio Distribuidor = Precio Venta × (100% - comisión%)
      // Esto es lo que el distribuidor PAGA al admin
      const correctDistributorPrice = product.clientPrice * (100 - commission) / 100;
      
      const difference = Math.abs(oldDistributorPrice - correctDistributorPrice);
      
      if (difference > 0.01) {
        updates.push({
          product,
          oldPrice: oldDistributorPrice,
          correctPrice: correctDistributorPrice,
          commission,
          difference: correctDistributorPrice - oldDistributorPrice
        });
      }
    }

    if (updates.length === 0) {
      console.log('✅ ¡Todos los precios de distribuidor están correctos! No hay nada que actualizar.\n');
      await mongoose.connection.close();
      return;
    }

    console.log(`${'-'.repeat(100)}`);
    console.log(`🔍 PRODUCTOS QUE NECESITAN CORRECCIÓN: ${updates.length} de ${products.length}`);
    console.log(`${'-'.repeat(100)}\n`);

    // Mostrar todos los productos que cambiarán
    updates.forEach((item, i) => {
      const { product, oldPrice, correctPrice, commission, difference } = item;
      
      console.log(`${i + 1}. ${product.name}`);
      console.log(`   Comisión: ${commission}%`);
      console.log(`   Precio Venta (Cliente): $${product.clientPrice.toLocaleString('es-CO')}`);
      console.log(`   
   PRECIO DISTRIBUIDOR ACTUAL (INCORRECTO):
     $${oldPrice.toLocaleString('es-CO')}
   
   PRECIO DISTRIBUIDOR CORRECTO:
     $${correctPrice.toLocaleString('es-CO')} (${difference >= 0 ? '+' : ''}$${difference.toLocaleString('es-CO')})
   
   VERIFICACIÓN:
     Ganancia Admin = $${correctPrice.toLocaleString('es-CO')} - $${product.purchasePrice.toLocaleString('es-CO')} = $${(correctPrice - product.purchasePrice).toLocaleString('es-CO')}
     Ganancia Dist = $${product.clientPrice.toLocaleString('es-CO')} - $${correctPrice.toLocaleString('es-CO')} = $${(product.clientPrice - correctPrice).toLocaleString('es-CO')} (${commission}% de $${product.clientPrice.toLocaleString('es-CO')})
`);
    });

    console.log(`${'='.repeat(100)}`);
    console.log(`💡 RESUMEN:`);
    console.log(`${'='.repeat(100)}`);
    console.log(`Total de productos a actualizar: ${updates.length}`);
    console.log(`${'='.repeat(100)}\n`);

    if (!DRY_RUN) {
      console.log('🚀 Actualizando productos...\n');
      
      for (const item of updates) {
        await Product.updateOne(
          { _id: item.product._id },
          { $set: { distributorPrice: item.correctPrice } }
        );
        console.log(`✅ ${item.product.name} actualizado`);
      }
      
      console.log('\n✅ Todos los productos actualizados correctamente\n');
    } else {
      console.log('⚠️  MODO PREVIEW ACTIVADO - No se guardó nada en la base de datos');
      console.log('⚠️  Para ejecutar la actualización, cambia DRY_RUN = false en el código\n');
    }

    await mongoose.connection.close();
    console.log('✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixDistributorPrices();
