import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const checkAnalytics = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const Sale = mongoose.model('Sale', new mongoose.Schema({}, { strict: false }));
    const SpecialSale = mongoose.model('SpecialSale', new mongoose.Schema({}, { strict: false }));

    // Obtener fecha del mes actual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ventas normales del mes
    const normalSales = await Sale.find({
      saleDate: { $gte: startOfMonth },
      paymentStatus: "confirmado",
    });

    // Ventas especiales del mes
    const specialSales = await SpecialSale.find({
      saleDate: { $gte: startOfMonth },
      status: "active",
    });

    console.log("📊 MÉTRICAS DEL MES ACTUAL:\n");
    console.log("=== VENTAS NORMALES ===");
    console.log(`Cantidad: ${normalSales.length}`);
    
    const normalTotals = normalSales.reduce((acc, s) => {
      acc.revenue += s.salePrice * s.quantity;
      acc.profit += s.totalProfit;
      acc.units += s.quantity;
      return acc;
    }, { revenue: 0, profit: 0, units: 0 });

    console.log(`Revenue: $${normalTotals.revenue.toLocaleString()}`);
    console.log(`Ganancia: $${normalTotals.profit.toLocaleString()}`);
    console.log(`Unidades: ${normalTotals.units}`);

    console.log("\n=== VENTAS ESPECIALES ===");
    console.log(`Cantidad: ${specialSales.length}`);
    
    const specialTotals = specialSales.reduce((acc, s) => {
      acc.revenue += s.specialPrice * s.quantity;
      acc.profit += s.totalProfit;
      acc.units += s.quantity;
      return acc;
    }, { revenue: 0, profit: 0, units: 0 });

    console.log(`Revenue: $${specialTotals.revenue.toLocaleString()}`);
    console.log(`Ganancia: $${specialTotals.profit.toLocaleString()}`);
    console.log(`Unidades: ${specialTotals.units}`);

    console.log("\n=== TOTALES COMBINADOS ===");
    console.log(`Ventas totales: ${normalSales.length + specialSales.length}`);
    console.log(`Revenue total: $${(normalTotals.revenue + specialTotals.revenue).toLocaleString()}`);
    console.log(`Ganancia total: $${(normalTotals.profit + specialTotals.profit).toLocaleString()}`);
    console.log(`Unidades totales: ${normalTotals.units + specialTotals.units}`);

    // Verificar distribución en ventas especiales
    console.log("\n=== DISTRIBUCIÓN DE GANANCIAS (VENTAS ESPECIALES) ===");
    const distributionSummary = {};
    
    specialSales.forEach(sale => {
      sale.distribution.forEach(dist => {
        if (!distributionSummary[dist.name]) {
          distributionSummary[dist.name] = 0;
        }
        distributionSummary[dist.name] += dist.amount;
      });
    });

    Object.entries(distributionSummary).forEach(([name, amount]) => {
      console.log(`${name}: $${amount.toLocaleString()}`);
    });

    const totalDistributed = Object.values(distributionSummary).reduce((a, b) => a + b, 0);
    console.log(`\nTotal distribuido: $${totalDistributed.toLocaleString()}`);
    console.log(`Total ganancia ventas especiales: $${specialTotals.profit.toLocaleString()}`);
    console.log(`Diferencia: $${(specialTotals.profit - totalDistributed).toFixed(2)}`);

    await mongoose.connection.close();
    console.log("\n✅ Verificación de métricas completada");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
};

checkAnalytics();
