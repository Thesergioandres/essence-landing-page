import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const checkSpecialSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    // Obtener ventas especiales
    const SpecialSale = mongoose.model('SpecialSale', new mongoose.Schema({}, { strict: false }));
    const specialSales = await SpecialSale.find({}).sort({ createdAt: -1 }).limit(10);

    console.log("📊 VENTAS ESPECIALES GUARDADAS:");
    console.log("Total:", specialSales.length);
    console.log("");

    let totalRevenue = 0;
    let totalProfit = 0;

    specialSales.forEach((s, idx) => {
      const revenue = s.specialPrice * s.quantity;
      totalRevenue += revenue;
      totalProfit += s.totalProfit;

      console.log(`${idx + 1}. ${s.product.name} (${s.quantity}x)`);
      console.log(`   Precio unitario: $${s.specialPrice.toLocaleString()}`);
      console.log(`   Revenue total: $${revenue.toLocaleString()}`);
      console.log(`   Costo: $${s.cost.toLocaleString()}`);
      console.log(`   Ganancia: $${s.totalProfit.toLocaleString()}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Fecha: ${new Date(s.saleDate).toLocaleString('es-CO')}`);
      console.log(`   Distribución:`);
      s.distribution.forEach(d => {
        console.log(`     - ${d.name}: $${d.amount.toLocaleString()}`);
        if (d.notes) console.log(`       Notas: ${d.notes}`);
      });
      console.log("");
    });

    console.log("💰 TOTALES:");
    console.log(`   Revenue total: $${totalRevenue.toLocaleString()}`);
    console.log(`   Ganancia total: $${totalProfit.toLocaleString()}`);

    // Verificar productos con stock
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    console.log("\n📦 VERIFICANDO STOCK DE PRODUCTOS:\n");
    
    const productNames = [...new Set(specialSales.map(s => s.product.name))];
    for (const name of productNames) {
      const product = await Product.findOne({ name: name });
      if (product) {
        console.log(`${name}:`);
        console.log(`   Stock total: ${product.totalStock}`);
        console.log(`   Stock bodega: ${product.warehouseStock}`);
      }
    }

    await mongoose.connection.close();
    console.log("\n✅ Verificación completada");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

checkSpecialSales();
