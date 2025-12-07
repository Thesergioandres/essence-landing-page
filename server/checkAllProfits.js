import mongoose from "mongoose";
import dotenv from "dotenv";
import Sale from "./models/Sale.js";
import SpecialSale from "./models/SpecialSale.js";
import User from "./models/User.js";

dotenv.config();

const checkAllProfits = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    // Obtener todos los distribuidores
    const distributors = await User.find({ role: "distribuidor" }).select("name email");
    
    console.log("💰 GANANCIAS TOTALES - VENTAS NORMALES + VENTAS ESPECIALES\n");
    console.log("=".repeat(70));

    // ============ VENTAS NORMALES ============
    console.log("\n📊 VENTAS NORMALES:\n");

    // Ventas de Admin (sin distribuidor)
    const adminSales = await Sale.find({ 
      distributor: null,
      paymentStatus: "confirmado" 
    });
    
    const adminNormalProfit = adminSales.reduce((sum, sale) => sum + (sale.adminProfit || 0), 0);
    
    console.log(`Admin (Ventas Directas):`);
    console.log(`  Total ventas: ${adminSales.length}`);
    console.log(`  Ganancia: $${Math.round(adminNormalProfit).toLocaleString('es-CO')}`);
    console.log("");

    // Ganancias por distribuidor (ventas normales)
    const distributorNormalProfits = {};
    const distributorSalesCounts = {};

    for (const dist of distributors) {
      const sales = await Sale.find({ 
        distributor: dist._id,
        paymentStatus: "confirmado"
      });
      
      const totalDistributorProfit = sales.reduce((sum, sale) => sum + (sale.distributorProfit || 0), 0);
      const totalAdminProfitFromDist = sales.reduce((sum, sale) => sum + (sale.adminProfit || 0), 0);
      
      distributorNormalProfits[dist._id.toString()] = {
        name: dist.name,
        distributorProfit: totalDistributorProfit,
        adminProfitFromDistributor: totalAdminProfitFromDist,
        salesCount: sales.length
      };
      
      distributorSalesCounts[dist._id.toString()] = sales.length;

      console.log(`${dist.name}:`);
      console.log(`  Total ventas: ${sales.length}`);
      console.log(`  Ganancia distribuidor: $${Math.round(totalDistributorProfit).toLocaleString('es-CO')}`);
      console.log(`  Ganancia admin (de sus ventas): $${Math.round(totalAdminProfitFromDist).toLocaleString('es-CO')}`);
      console.log("");
    }

    // ============ VENTAS ESPECIALES ============
    console.log("\n🌟 VENTAS ESPECIALES:\n");

    const specialSales = await SpecialSale.find({ status: "active" });
    
    console.log(`Total ventas especiales: ${specialSales.length}\n`);

    // Sumar ganancias de ventas especiales por distribuidor
    const specialProfits = {
      admin: 0
    };

    // Inicializar con los distribuidores existentes
    distributors.forEach(dist => {
      specialProfits[dist._id.toString()] = 0;
    });

    // Buscar por nombre en la distribución
    const distributorsByName = {};
    distributors.forEach(dist => {
      const nameLower = dist.name.toLowerCase();
      distributorsByName[nameLower] = dist._id.toString();
    });

    specialSales.forEach(sale => {
      sale.distribution.forEach(dist => {
        const name = dist.name || dist.distributorName || '';
        const nameLower = name.toLowerCase();
        const amount = dist.amount;

        if (nameLower.includes('admin')) {
          specialProfits.admin += amount;
        } else if (nameLower.includes('nicolas')) {
          const nicolasId = Object.keys(distributorNormalProfits).find(id => 
            distributorNormalProfits[id].name.toLowerCase().includes('nicolas')
          );
          if (nicolasId) specialProfits[nicolasId] += amount;
        } else if (nameLower.includes('izan')) {
          const izanId = Object.keys(distributorNormalProfits).find(id => 
            distributorNormalProfits[id].name.toLowerCase().includes('izan')
          );
          if (izanId) specialProfits[izanId] += amount;
        } else if (nameLower.includes('diego')) {
          const diegoId = Object.keys(distributorNormalProfits).find(id => 
            distributorNormalProfits[id].name.toLowerCase().includes('diego')
          );
          if (diegoId) specialProfits[diegoId] += amount;
        }
      });
    });

    console.log("Distribución de ventas especiales:");
    console.log(`  Admin: $${Math.round(specialProfits.admin).toLocaleString('es-CO')}`);
    
    for (const dist of distributors) {
      const distId = dist._id.toString();
      const specialProfit = specialProfits[distId] || 0;
      console.log(`  ${dist.name}: $${Math.round(specialProfit).toLocaleString('es-CO')}`);
    }

    // ============ TOTALES COMBINADOS ============
    console.log("\n" + "=".repeat(70));
    console.log("\n💎 RESUMEN TOTAL (VENTAS NORMALES + ESPECIALES):\n");

    // Admin total
    const adminTotalFromDistributors = Object.values(distributorNormalProfits)
      .reduce((sum, d) => sum + d.adminProfitFromDistributor, 0);
    const adminTotalProfit = adminNormalProfit + adminTotalFromDistributors + specialProfits.admin;

    console.log(`👑 ADMIN:`);
    console.log(`  Ventas directas: $${Math.round(adminNormalProfit).toLocaleString('es-CO')}`);
    console.log(`  De ventas distribuidores: $${Math.round(adminTotalFromDistributors).toLocaleString('es-CO')}`);
    console.log(`  Ventas especiales: $${Math.round(specialProfits.admin).toLocaleString('es-CO')}`);
    console.log(`  ───────────────────────────────`);
    console.log(`  TOTAL: $${Math.round(adminTotalProfit).toLocaleString('es-CO')}`);
    console.log("");

    // Distribuidores totales
    for (const dist of distributors) {
      const distId = dist._id.toString();
      const normalData = distributorNormalProfits[distId];
      const specialProfit = specialProfits[distId] || 0;
      const totalProfit = normalData.distributorProfit + specialProfit;

      console.log(`📦 ${dist.name.toUpperCase()}:`);
      console.log(`  Ventas normales (${normalData.salesCount}): $${Math.round(normalData.distributorProfit).toLocaleString('es-CO')}`);
      console.log(`  Ventas especiales: $${Math.round(specialProfit).toLocaleString('es-CO')}`);
      console.log(`  ───────────────────────────────`);
      console.log(`  TOTAL: $${Math.round(totalProfit).toLocaleString('es-CO')}`);
      console.log("");
    }

    // Gran total
    const totalNormalSales = adminSales.length + Object.values(distributorSalesCounts).reduce((a, b) => a + b, 0);
    const totalAllSales = totalNormalSales + specialSales.length;
    
    const grandTotalNormal = adminNormalProfit + 
      Object.values(distributorNormalProfits).reduce((sum, d) => sum + d.distributorProfit + d.adminProfitFromDistributor, 0);
    
    const grandTotalSpecial = Object.values(specialProfits).reduce((sum, profit) => sum + profit, 0);
    const grandTotal = grandTotalNormal + grandTotalSpecial;

    console.log("=".repeat(70));
    console.log("\n🎯 GRAN TOTAL:");
    console.log(`  Total ventas normales: ${totalNormalSales} ventas`);
    console.log(`  Total ventas especiales: ${specialSales.length} ventas`);
    console.log(`  Total todas las ventas: ${totalAllSales} ventas`);
    console.log("");
    console.log(`  Ganancias ventas normales: $${Math.round(grandTotalNormal).toLocaleString('es-CO')}`);
    console.log(`  Ganancias ventas especiales: $${Math.round(grandTotalSpecial).toLocaleString('es-CO')}`);
    console.log(`  ═══════════════════════════════`);
    console.log(`  GANANCIA TOTAL: $${Math.round(grandTotal).toLocaleString('es-CO')}`);
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkAllProfits();
