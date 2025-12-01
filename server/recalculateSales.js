import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import dotenv from "dotenv";

dotenv.config();

const recalculateSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Obtener todas las ventas
    const sales = await Sale.find({});
    console.log(`📊 Total de ventas a recalcular: ${sales.length}`);

    let updated = 0;

    for (const sale of sales) {
      const oldAdminProfit = sale.adminProfit;
      const oldDistributorProfit = sale.distributorProfit;

      // Recalcular según el nuevo sistema
      if (!sale.distributor) {
        // Venta Admin
        sale.adminProfit = (sale.salePrice - sale.purchasePrice) * sale.quantity;
        sale.distributorProfit = 0;
        sale.commissionBonus = 0;
        sale.commissionBonusAmount = 0;
        sale.totalProfit = sale.adminProfit;
      } else {
        // Venta de distribuidor
        const totalPercentage = 20 + (sale.commissionBonus || 0);
        
        // Ganancia del distribuidor: precio de venta * porcentaje total
        sale.distributorProfit = (sale.salePrice * totalPercentage / 100) * sale.quantity;
        sale.commissionBonusAmount = (sale.salePrice * (sale.commissionBonus || 0) / 100) * sale.quantity;

        // Ganancia del admin: precio venta - ganancia distribuidor - precio de compra
        sale.adminProfit = ((sale.salePrice - (sale.salePrice * totalPercentage / 100) - sale.purchasePrice) * sale.quantity);

        // Ganancia total
        sale.totalProfit = sale.distributorProfit + sale.adminProfit;
      }

      // Guardar sin activar el pre-save hook (usando updateOne)
      await Sale.updateOne(
        { _id: sale._id },
        {
          $set: {
            adminProfit: sale.adminProfit,
            distributorProfit: sale.distributorProfit,
            commissionBonusAmount: sale.commissionBonusAmount,
            totalProfit: sale.totalProfit,
          },
        }
      );

      updated++;

      console.log(
        `✓ Venta ${sale._id} recalculada:`,
        `\n  Admin: $${oldAdminProfit.toFixed(0)} → $${sale.adminProfit.toFixed(0)}`,
        `\n  Dist: $${oldDistributorProfit.toFixed(0)} → $${sale.distributorProfit.toFixed(0)}`
      );
    }

    console.log(`\n✅ Recalculadas ${updated} ventas exitosamente`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

recalculateSales();
