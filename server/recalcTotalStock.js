import dotenv from "dotenv";
import mongoose from "mongoose";
import BranchStock from "./models/BranchStock.js";
import Product from "./models/Product.js";

dotenv.config();

const recalculateTotalStock = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const products = await Product.find({});
    console.log(`📦 Procesando ${products.length} productos...`);

    for (const product of products) {
      // Calcular el stock total de todas las sedes
      const branchStocks = await BranchStock.find({
        business: product.business,
        product: product._id,
      });

      const totalBranchStock = branchStocks.reduce(
        (sum, bs) => sum + (bs.quantity || 0),
        0
      );

      const correctTotalStock =
        (product.warehouseStock || 0) + totalBranchStock;

      if (product.totalStock !== correctTotalStock) {
        console.log(`\n🔧 Corrigiendo: ${product.name}`);
        console.log(`   Anterior totalStock: ${product.totalStock}`);
        console.log(`   warehouseStock: ${product.warehouseStock || 0}`);
        console.log(`   Stock en sedes: ${totalBranchStock}`);
        console.log(`   Nuevo totalStock: ${correctTotalStock}`);

        product.totalStock = correctTotalStock;
        await product.save();
      }
    }

    console.log("\n✅ Recalculación completada");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

recalculateTotalStock();
