import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import DistributorStock from "./models/DistributorStock.js";
import Product from "./models/Product.js";
import Sale from "./models/Sale.js";
import User from "./models/User.js";

dotenv.config();

async function seedDistributorsAndSales() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Obtener productos
    const products = await Product.find();
    if (products.length === 0) {
      console.log("❌ No hay productos. Ejecuta seedData.js primero.");
      process.exit(1);
    }

    // Aumentar stock de productos para las pruebas
    console.log("\n📦 Aumentando stock de productos...");
    for (const product of products) {
      product.warehouseStock = 200;
      product.totalStock = 200;
      await product.save();
    }
    console.log("✅ Stock aumentado");

    // Crear distribuidores
    console.log("\n👥 Creando distribuidores...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("distribuidor123", salt);

    const distributors = [
      {
        name: "María González",
        email: "maria@example.com",
        password: hashedPassword,
        role: "distribuidor",
        phone: "555-0001",
        address: "Calle Principal 123",
        active: true,
      },
      {
        name: "Juan Pérez",
        email: "juan@example.com",
        password: hashedPassword,
        role: "distribuidor",
        phone: "555-0002",
        address: "Avenida Secundaria 456",
        active: true,
      },
      {
        name: "Ana Martínez",
        email: "ana@example.com",
        password: hashedPassword,
        role: "distribuidor",
        phone: "555-0003",
        address: "Boulevard Norte 789",
        active: true,
      },
    ];

    // Limpiar distribuidores anteriores
    await User.deleteMany({ role: "distribuidor" });

    const createdDistributors = await User.insertMany(distributors);
    console.log(`✅ ${createdDistributors.length} distribuidores creados`);

    // Asignar stock a distribuidores
    console.log("\n📦 Asignando stock a distribuidores...");
    await DistributorStock.deleteMany({});

    for (const distributor of createdDistributors) {
      for (const product of products) {
        const quantity = Math.floor(Math.random() * 20) + 10; // 10-30 unidades

        await DistributorStock.create({
          distributor: distributor._id,
          product: product._id,
          quantity,
        });

        // Actualizar stock del almacén
        product.warehouseStock -= quantity;
        await product.save();
      }
    }
    console.log("✅ Stock asignado");

    // Crear ventas de ejemplo
    console.log("\n💰 Creando ventas de ejemplo...");
    await Sale.deleteMany({});

    const salesData = [];
    const today = new Date();

    for (const distributor of createdDistributors) {
      const numSales = Math.floor(Math.random() * 10) + 5; // 5-15 ventas por distribuidor

      for (let i = 0; i < numSales; i++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 unidades
        const daysAgo = Math.floor(Math.random() * 30); // Ventas en los últimos 30 días

        salesData.push({
          distributor: distributor._id,
          product: product._id,
          quantity,
          purchasePrice: product.purchasePrice,
          distributorPrice: product.distributorPrice,
          salePrice: product.clientPrice,
          totalRevenue: product.clientPrice * quantity,
          adminProfit:
            (product.clientPrice - product.distributorPrice) * quantity,
          distributorProfit: product.distributorCommission * quantity,
          paymentConfirmed: Math.random() > 0.3, // 70% confirmados
          saleDate: new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        });
      }
    }

    const createdSales = await Sale.insertMany(salesData);
    console.log(`✅ ${createdSales.length} ventas creadas`);

    console.log("\n🎉 ¡Datos de prueba creados exitosamente!");
    console.log("\n📊 Resumen:");
    console.log(`   - Distribuidores: ${createdDistributors.length}`);
    console.log(`   - Ventas: ${createdSales.length}`);
    console.log("\n🔑 Credenciales de distribuidores:");
    console.log(
      "   Email: maria@example.com, juan@example.com, ana@example.com"
    );
    console.log("   Password: distribuidor123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

seedDistributorsAndSales();
