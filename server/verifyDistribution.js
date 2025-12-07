import mongoose from "mongoose";
import dotenv from "dotenv";
import SpecialSale from "./models/SpecialSale.js";

dotenv.config();

const verifyDistribution = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const specialSales = await SpecialSale.find({ status: "active" });

    console.log("📊 VERIFICACIÓN DE DISTRIBUCIÓN DE GANANCIAS\n");
    console.log(`Total de ventas especiales: ${specialSales.length}\n`);

    // Sumar ganancias por distribuidor
    const totals = {
      nicolas: 0,
      izan: 0,
      diego: 0,
      admin: 0,
      total: 0
    };

    specialSales.forEach((sale, index) => {
      console.log(`${index + 1}. ${sale.product.name} (${sale.quantity}x)`);
      console.log(`   Ganancia total: $${sale.totalProfit.toLocaleString('es-CO')}`);
      console.log(`   Distribución:`);
      
      sale.distribution.forEach(dist => {
        const amount = dist.amount;
        const name = dist.name || dist.distributorName || 'Sin nombre';
        const percentage = dist.percentage || 0;
        
        console.log(`     - ${name}: $${amount.toLocaleString('es-CO')} (${percentage}%)`);
        
        // Sumar al total correspondiente
        const nameLower = name.toLowerCase();
        if (nameLower.includes('nicolas')) {
          totals.nicolas += amount;
        } else if (nameLower.includes('izan')) {
          totals.izan += amount;
        } else if (nameLower.includes('diego')) {
          totals.diego += amount;
        } else if (nameLower.includes('admin')) {
          totals.admin += amount;
        }
        
        totals.total += amount;
      });
      console.log('');
    });

    console.log("💰 TOTALES POR DISTRIBUIDOR:\n");
    console.log(`Nicolas:  $${Math.round(totals.nicolas).toLocaleString('es-CO')}`);
    console.log(`IZAN:     $${Math.round(totals.izan).toLocaleString('es-CO')}`);
    console.log(`Diego:    $${Math.round(totals.diego).toLocaleString('es-CO')}`);
    console.log(`Admin:    $${Math.round(totals.admin).toLocaleString('es-CO')}`);
    console.log(`─────────────────────────────`);
    console.log(`TOTAL:    $${Math.round(totals.total).toLocaleString('es-CO')}`);

    // Calcular ganancia total esperada
    const expectedTotal = specialSales.reduce((sum, sale) => sum + sale.totalProfit, 0);
    console.log(`\n✅ Ganancia total esperada: $${Math.round(expectedTotal).toLocaleString('es-CO')}`);
    
    const difference = Math.abs(totals.total - expectedTotal);
    if (difference < 1) {
      console.log(`✅ La distribución es correcta (diferencia: $${difference.toFixed(2)})`);
    } else {
      console.log(`⚠️  Hay una diferencia de: $${Math.round(difference).toLocaleString('es-CO')}`);
    }

    // Verificar porcentajes
    console.log("\n📊 PORCENTAJES DE DISTRIBUCIÓN:");
    console.log(`Nicolas:  ${((totals.nicolas / totals.total) * 100).toFixed(2)}%`);
    console.log(`IZAN:     ${((totals.izan / totals.total) * 100).toFixed(2)}%`);
    console.log(`Diego:    ${((totals.diego / totals.total) * 100).toFixed(2)}%`);
    console.log(`Admin:    ${((totals.admin / totals.total) * 100).toFixed(2)}%`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

verifyDistribution();
