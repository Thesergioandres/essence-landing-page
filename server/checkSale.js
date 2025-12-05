import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const checkSale = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Sale = mongoose.model('Sale', new mongoose.Schema({}, { strict: false }));
    const sale = await Sale.findOne({ _id: '69276c9f541bbf245c3cbe01' });
    
    console.log('Venta MTRX - Maria Jose (Rango 1 - 25%):');
    console.log('ID:', sale._id.toString());
    console.log('Precio Compra:', sale.purchasePrice);
    console.log('Precio Distribuidor:', sale.distributorPrice);
    console.log('Precio Venta:', sale.salePrice);
    console.log('Cantidad:', sale.quantity);
    console.log('Comisión:', sale.distributorProfitPercentage + '%');
    
    console.log('\n📊 GANANCIAS GUARDADAS EN BD:');
    console.log('Admin Profit:', sale.adminProfit);
    console.log('Distributor Profit:', sale.distributorProfit);
    console.log('Total Profit:', sale.totalProfit);
    
    console.log('\n🔢 CÁLCULO MANUAL (Fórmula actual):');
    const commission = sale.distributorProfitPercentage;
    const distProfit = (sale.salePrice * commission / 100) * sale.quantity;
    const adminProfit = ((sale.salePrice - (sale.salePrice * commission / 100) - sale.purchasePrice) * sale.quantity);
    console.log(`Dist Profit = (${sale.salePrice} * ${commission}%) * ${sale.quantity} = $${distProfit.toLocaleString('es-CO')}`);
    console.log(`Admin Profit = ((${sale.salePrice} - ${distProfit} - ${sale.purchasePrice}) * ${sale.quantity}) = $${adminProfit.toLocaleString('es-CO')}`);
    
    console.log('\n✅ VERIFICACIÓN:');
    console.log(`Precio que dist PAGA al admin = ${sale.salePrice} - ${distProfit} = $${(sale.salePrice - distProfit).toLocaleString('es-CO')}`);
    console.log(`Ganancia admin = ${sale.salePrice - distProfit} - ${sale.purchasePrice} = $${adminProfit.toLocaleString('es-CO')}`);
    
    console.log('\n🆚 COMPARACIÓN CON TU ANÁLISIS:');
    console.log('Tú dijiste:');
    console.log('  Precio Distribuidor = $17,600 (INCORRECTO)');
    console.log('  Ganancia Admin = $17,600 - $10,500 = $7,100');
    console.log('  Ganancia Dist = $22,000 - $17,600 = $4,400');
    console.log('\nLo correcto según 25% comisión:');
    console.log(`  Precio que dist PAGA = $${(sale.salePrice - distProfit).toLocaleString('es-CO')}`);
    console.log(`  Ganancia Admin = $${adminProfit.toLocaleString('es-CO')}`);
    console.log(`  Ganancia Dist = $${distProfit.toLocaleString('es-CO')}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkSale();
