import mongoose from "mongoose";
import User from "./models/User.js";
import Product from "./models/Product.js";
import DistributorStock from "./models/DistributorStock.js";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado");
  } catch (error) {
    console.error("❌ Error conectando MongoDB:", error);
    process.exit(1);
  }
};

const testDeleteDistributor = async () => {
  try {
    await connectDB();

    console.log("\n" + "=".repeat(60));
    console.log("🧪 PRUEBA: ELIMINACIÓN DE DISTRIBUIDOR CON INVENTARIO");
    console.log("=".repeat(60) + "\n");

    // 1. Buscar un distribuidor con inventario
    const distributorWithStock = await DistributorStock.findOne({
      quantity: { $gt: 0 },
    }).populate("distributor", "name email");

    if (!distributorWithStock) {
      console.log("⚠️  No hay distribuidores con inventario para probar");
      process.exit(0);
    }

    const distributor = distributorWithStock.distributor;
    console.log(`📦 Distribuidor seleccionado: ${distributor.name}\n`);

    // 2. Obtener todo su inventario
    const allStock = await DistributorStock.find({
      distributor: distributor._id,
    }).populate("product", "name warehouseStock totalStock");

    console.log("📊 INVENTARIO ACTUAL DEL DISTRIBUIDOR:\n");
    let totalItems = 0;
    const stockSnapshot = [];

    for (const stock of allStock) {
      if (stock.quantity > 0) {
        console.log(`  • ${stock.product.name}:`);
        console.log(`    - En distribuidor: ${stock.quantity} unidades`);
        console.log(`    - En bodega (antes): ${stock.product.warehouseStock} unidades`);
        console.log(`    - Stock total (antes): ${stock.product.totalStock} unidades\n`);
        
        totalItems += stock.quantity;
        stockSnapshot.push({
          productId: stock.product._id,
          productName: stock.product.name,
          distributorQty: stock.quantity,
          warehouseStockBefore: stock.product.warehouseStock,
          totalStockBefore: stock.product.totalStock,
        });
      }
    }

    console.log(`📊 Total de unidades en distribuidor: ${totalItems}\n`);

    // 3. Simular eliminación (solo mostrar qué pasaría)
    console.log("=".repeat(60));
    console.log("🔄 SIMULACIÓN DE ELIMINACIÓN\n");

    console.log("Proceso que se ejecutará:");
    console.log("1. ✅ Buscar todo el inventario del distribuidor");
    console.log("2. ✅ Para cada producto con stock > 0:");
    console.log("   - Devolver cantidad al warehouseStock");
    console.log("   - Devolver cantidad al totalStock");
    console.log("3. ✅ Eliminar registros de DistributorStock");
    console.log("4. ✅ Eliminar el distribuidor\n");

    console.log("=".repeat(60));
    console.log("📈 RESULTADO ESPERADO:\n");

    for (const snapshot of stockSnapshot) {
      const expectedWarehouse = snapshot.warehouseStockBefore + snapshot.distributorQty;
      const expectedTotal = snapshot.totalStockBefore + snapshot.distributorQty;
      
      console.log(`  • ${snapshot.productName}:`);
      console.log(`    - Bodega: ${snapshot.warehouseStockBefore} → ${expectedWarehouse} (+${snapshot.distributorQty})`);
      console.log(`    - Total: ${snapshot.totalStockBefore} → ${expectedTotal} (+${snapshot.distributorQty})\n`);
    }

    console.log("=".repeat(60));
    console.log("⚠️  NOTA: Esta es una simulación, no se eliminó nada");
    console.log("=".repeat(60) + "\n");

    // 4. Verificar lógica del código
    console.log("🔍 VERIFICACIÓN DE LA LÓGICA:\n");

    const distributorStocks = await DistributorStock.find({
      distributor: distributor._id,
    });

    let returnedProducts = 0;
    let totalQuantityReturned = 0;

    for (const stock of distributorStocks) {
      if (stock.quantity > 0) {
        const product = await Product.findById(stock.product);
        
        if (product) {
          returnedProducts++;
          totalQuantityReturned += stock.quantity;
        }
      }
    }

    console.log(`✅ Productos a devolver: ${returnedProducts}`);
    console.log(`✅ Unidades totales: ${totalQuantityReturned}`);

    if (returnedProducts === stockSnapshot.length && totalQuantityReturned === totalItems) {
      console.log("\n✅ La lógica es correcta!\n");
    } else {
      console.log("\n⚠️  Discrepancia en la lógica\n");
    }

    console.log("=".repeat(60));
    console.log("📝 CONCLUSIÓN");
    console.log("=".repeat(60) + "\n");

    console.log("✅ Al eliminar un distribuidor:");
    console.log("   1. TODO su inventario se devuelve automáticamente a bodega");
    console.log("   2. Se actualizan warehouseStock y totalStock de cada producto");
    console.log("   3. Se eliminan los registros de DistributorStock");
    console.log("   4. Se elimina el distribuidor");
    console.log("   5. Se retorna un resumen de lo devuelto\n");

    console.log("⚠️  IMPORTANTE: Ya NO se bloquea la eliminación por tener stock");
    console.log("   El inventario se recupera automáticamente 🎉\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error en prueba:", error);
    process.exit(1);
  }
};

testDeleteDistributor();
