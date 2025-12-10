import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Product from "./models/Product.js";
import DistributorStock from "./models/DistributorStock.js";

dotenv.config();

async function checkDistributorCatalog() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/essence-db");
    console.log("✅ Conectado a MongoDB\n");

    // Buscar distribuidores
    const distributors = await User.find({ role: "distribuidor" });
    console.log(`📊 Total de distribuidores: ${distributors.length}\n`);

    for (const distributor of distributors) {
      console.log(`\n👤 Distribuidor: ${distributor.name} (${distributor.email})`);
      console.log(`   ID: ${distributor._id}`);

      // Buscar TODO el stock del distribuidor (incluso con quantity 0)
      const allStock = await DistributorStock.find({ 
        distributor: distributor._id 
      }).populate("product");

      console.log(`   📦 Registros de stock totales: ${allStock.length}`);

      // Stock con cantidad > 0
      const availableStock = allStock.filter(s => s.quantity > 0);
      console.log(`   ✅ Productos con stock disponible: ${availableStock.length}`);

      if (availableStock.length > 0) {
        console.log("\n   Productos disponibles:");
        availableStock.forEach(stock => {
          const productName = stock.product ? stock.product.name : "PRODUCTO ELIMINADO";
          console.log(`      - ${productName}: ${stock.quantity} unidades`);
        });
      } else if (allStock.length > 0) {
        console.log("\n   ⚠️  Todos los productos tienen stock = 0");
        allStock.forEach(stock => {
          const productName = stock.product ? stock.product.name : "PRODUCTO ELIMINADO";
          console.log(`      - ${productName}: ${stock.quantity} unidades`);
        });
      } else {
        console.log("\n   ⚠️  No tiene productos asignados");
      }
    }

    console.log("\n\n📝 Resumen:");
    const totalStocks = await DistributorStock.countDocuments();
    const stocksWithQuantity = await DistributorStock.countDocuments({ quantity: { $gt: 0 } });
    console.log(`Total de registros en DistributorStock: ${totalStocks}`);
    console.log(`Registros con cantidad > 0: ${stocksWithQuantity}`);
    console.log(`Registros con cantidad = 0: ${totalStocks - stocksWithQuantity}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Desconectado de MongoDB");
    process.exit(0);
  }
}

checkDistributorCatalog();
