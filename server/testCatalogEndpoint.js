import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Product from "./models/Product.js";
import Category from "./models/Category.js";
import DistributorStock from "./models/DistributorStock.js";

dotenv.config();

async function testCatalogEndpoint() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/essence-db");
    console.log("✅ Conectado a MongoDB\n");

    // Obtener un distribuidor de ejemplo
    const distributor = await User.findOne({ role: "distribuidor" });
    
    if (!distributor) {
      console.log("❌ No se encontró ningún distribuidor");
      return;
    }

    console.log(`👤 Distribuidor: ${distributor.name}`);
    console.log(`   Email: ${distributor.email}`);
    console.log(`   ID: ${distributor._id}\n`);

    // Simular lo que hace el endpoint getDistributorCatalog
    console.log("📦 Buscando productos del distribuidor...");
    
    const distributorStocks = await DistributorStock.find({ 
      distributor: distributor._id,
      quantity: { $gt: 0 }
    }).populate({
      path: "product",
      populate: { path: "category" }
    });

    console.log(`✅ Encontrados ${distributorStocks.length} registros de stock\n`);

    if (distributorStocks.length === 0) {
      console.log("⚠️  No hay productos con stock > 0 para este distribuidor");
      return;
    }

    // Filtrar productos nulos y mapear
    const products = distributorStocks
      .filter(stock => {
        if (!stock.product) {
          console.log(`⚠️  Stock sin producto asociado: ${stock._id}`);
          return false;
        }
        return true;
      })
      .map(stock => {
        const product = stock.product.toObject();
        return {
          ...product,
          distributorStock: stock.quantity
        };
      });

    console.log(`📤 Total productos a enviar: ${products.length}\n`);

    if (products.length > 0) {
      console.log("Productos en el catálogo:");
      products.forEach(p => {
        console.log(`  - ${p.name} (Stock: ${p.distributorStock}) - Categoría: ${p.category?.name || 'Sin categoría'}`);
      });
    }

    // Generar un token de ejemplo
    console.log("\n🔑 Generando token JWT de ejemplo...");
    const token = jwt.sign(
      { 
        userId: distributor._id, 
        role: distributor.role 
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    console.log("\n📋 Para probar en el frontend:");
    console.log("1. Abre la consola del navegador");
    console.log("2. Ejecuta:");
    console.log(`   localStorage.setItem("token", "${token}")`);
    console.log(`   localStorage.setItem("user", '${JSON.stringify({ _id: distributor._id, name: distributor.name, email: distributor.email, role: distributor.role })}')`);
    console.log("3. Recarga la página");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Desconectado de MongoDB");
    process.exit(0);
  }
}

testCatalogEndpoint();
