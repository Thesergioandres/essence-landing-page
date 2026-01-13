import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const simulateMultipleSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const Product = mongoose.model(
      "Product",
      new mongoose.Schema({}, { strict: false })
    );

    // Buscar el primer producto con stock
    const product = await Product.findOne({ warehouseStock: { $gt: 0 } });

    if (!product) {
      console.log("❌ No hay productos con stock en bodega");
      process.exit(1);
    }

    console.log(`📦 Producto: ${product.name}`);
    console.log(`   Stock inicial en bodega: ${product.warehouseStock}`);
    console.log(`   Stock total inicial: ${product.totalStock}\n`);

    // Simular 3 ventas consecutivas de 2 unidades cada una
    const salesQuantities = [2, 2, 2];

    console.log("🔍 Simulando ventas múltiples del mismo producto:\n");

    for (let i = 0; i < salesQuantities.length; i++) {
      const quantity = salesQuantities[i];

      // Recargar el producto para obtener el stock actual
      const currentProduct = await Product.findById(product._id);
      const currentWarehouseStock = currentProduct.warehouseStock || 0;

      console.log(`Venta ${i + 1}: ${quantity} unidades`);
      console.log(
        `  Stock en bodega ANTES de validar: ${currentWarehouseStock}`
      );

      // Validar stock
      if (currentWarehouseStock < quantity) {
        console.log(
          `  ❌ Stock insuficiente. Disponible: ${currentWarehouseStock}, solicitado: ${quantity}`
        );
        console.log(`\n💡 PROBLEMA IDENTIFICADO:`);
        console.log(
          `   La venta ${
            i + 1
          } falló porque las ventas anteriores ya descontaron el stock.`
        );
        console.log(`   Stock inicial: ${product.warehouseStock}`);
        console.log(
          `   Stock después de ${i} ventas: ${currentWarehouseStock}`
        );
        console.log(`   Stock requerido: ${quantity}`);
        break;
      } else {
        console.log(`  ✅ Stock suficiente`);
        // Simular descuento de stock
        await Product.findByIdAndUpdate(product._id, {
          $inc: {
            warehouseStock: -quantity,
            totalStock: -quantity,
          },
        });
        console.log(
          `  Stock en bodega DESPUÉS del descuento: ${
            currentWarehouseStock - quantity
          }\n`
        );
      }
    }

    // Mostrar estado final
    const finalProduct = await Product.findById(product._id);
    console.log(`\n📊 Estado final:`);
    console.log(`   Stock en bodega: ${finalProduct.warehouseStock}`);
    console.log(`   Stock total: ${finalProduct.totalStock}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

simulateMultipleSales();
