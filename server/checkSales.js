import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "./models/Sale.js";

dotenv.config();

async function checkSales() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const sales = await Sale.find().populate("distributor product");

    console.log(`📊 Total de ventas: ${sales.length}\n`);

    if (sales.length > 0) {
      console.log("🔍 Muestra de las primeras 5 ventas:");
      sales.slice(0, 5).forEach((sale, i) => {
        console.log(`\n${i + 1}. Venta:`);
        console.log(`   - Distribuidor: ${sale.distributor?.name || "N/A"}`);
        console.log(`   - Producto: ${sale.product?.name || "N/A"}`);
        console.log(`   - Cantidad: ${sale.quantity}`);
        console.log(`   - Fecha: ${sale.saleDate || sale.createdAt}`);
        console.log(`   - Ganancia Admin: $${sale.adminProfit}`);
        console.log(`   - Ganancia Distribuidor: $${sale.distributorProfit}`);
      });

      // Calcular totales
      const totalRevenue = sales.reduce(
        (sum, s) => sum + (s.totalRevenue || 0),
        0
      );
      const totalAdminProfit = sales.reduce(
        (sum, s) => sum + (s.adminProfit || 0),
        0
      );
      const totalDistributorProfit = sales.reduce(
        (sum, s) => sum + (s.distributorProfit || 0),
        0
      );

      console.log(`\n💰 Totales:`);
      console.log(`   - Ingresos totales: $${totalRevenue.toLocaleString()}`);
      console.log(`   - Ganancia admin: $${totalAdminProfit.toLocaleString()}`);
      console.log(
        `   - Ganancia distribuidores: $${totalDistributorProfit.toLocaleString()}`
      );
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkSales();
