import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Product from "./models/Product.js";
import DistributorStock from "./models/DistributorStock.js";

dotenv.config();

async function testTransfer() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/essence-db");
    console.log("✅ Conectado a MongoDB\n");

    // Obtener 2 distribuidores con stock
    const distributors = await User.find({ role: "distribuidor" }).limit(2);
    
    if (distributors.length < 2) {
      console.log("❌ Se necesitan al menos 2 distribuidores");
      return;
    }

    const fromDistributor = distributors[0];
    const toDistributor = distributors[1];

    console.log(`📤 De: ${fromDistributor.name} (${fromDistributor._id})`);
    console.log(`📥 Para: ${toDistributor.name} (${toDistributor._id})\n`);

    // Buscar stock del primer distribuidor
    const stock = await DistributorStock.findOne({
      distributor: fromDistributor._id,
      quantity: { $gt: 1 }
    }).populate("product");

    if (!stock) {
      console.log("❌ El distribuidor origen no tiene stock suficiente");
      return;
    }

    console.log(`📦 Producto a transferir: ${stock.product.name}`);
    console.log(`   Stock actual: ${stock.quantity} unidades`);
    console.log(`   Cantidad a transferir: 1 unidad\n`);

    // Simular la transferencia
    const productId = stock.product._id;
    const quantity = 1;

    console.log("🔄 Simulando transferencia...\n");

    // 1. Verificar stock origen
    const fromStock = await DistributorStock.findOne({
      distributor: fromDistributor._id,
      product: productId
    });

    console.log("1️⃣ Stock origen antes:");
    console.log(`   Cantidad: ${fromStock.quantity}`);

    if (fromStock.quantity < quantity) {
      console.log("❌ Stock insuficiente");
      return;
    }

    // 2. Restar del origen
    fromStock.quantity -= quantity;
    console.log(`   Después de restar: ${fromStock.quantity}\n`);

    // 3. Buscar o crear stock destino
    let toStock = await DistributorStock.findOne({
      distributor: toDistributor._id,
      product: productId
    });

    if (toStock) {
      console.log("2️⃣ Stock destino encontrado:");
      console.log(`   Cantidad antes: ${toStock.quantity}`);
      toStock.quantity += quantity;
      console.log(`   Cantidad después: ${toStock.quantity}\n`);
    } else {
      console.log("2️⃣ Stock destino NO existe, creando nuevo registro\n");
      toStock = new DistributorStock({
        distributor: toDistributor._id,
        product: productId,
        quantity
      });
    }

    // 4. Verificar si el producto está en assignedProducts
    console.log("3️⃣ Verificando assignedProducts:");
    console.log(`   Productos asignados al destinatario: ${toDistributor.assignedProducts.length}`);
    
    const hasProduct = toDistributor.assignedProducts.some(
      p => p.toString() === productId.toString()
    );
    
    if (!hasProduct) {
      console.log(`   ⚠️  Producto NO asignado, se agregará`);
      toDistributor.assignedProducts.push(productId);
    } else {
      console.log(`   ✅ Producto ya está asignado`);
    }

    console.log("\n✅ SIMULACIÓN EXITOSA - No se guardaron cambios\n");
    
    console.log("📋 Resumen:");
    console.log(`   De: ${fromDistributor.name} - Stock restante: ${fromStock.quantity}`);
    console.log(`   Para: ${toDistributor.name} - Stock nuevo: ${toStock.quantity}`);
    console.log(`   Producto: ${stock.product.name}`);
    console.log(`   Cantidad transferida: ${quantity}`);

    // Para aplicar cambios reales, descomenta esto:
    // await fromStock.save();
    // await toStock.save();
    // await toDistributor.save();
    // console.log("\n💾 Cambios guardados en la base de datos");

  } catch (error) {
    console.error("❌ Error:", error);
    console.error("Stack:", error.stack);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Desconectado de MongoDB");
    process.exit(0);
  }
}

testTransfer();
