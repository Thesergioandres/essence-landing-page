import mongoose from "mongoose";
import dotenv from "dotenv";
import Sale from "./models/Sale.js";
import SpecialSale from "./models/SpecialSale.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import DistributorStock from "./models/DistributorStock.js";

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let testsPassed = 0;
let testsFailed = 0;

function testResult(passed, testName, details = '') {
  if (passed) {
    console.log(`${colors.green}✓ PASS${colors.reset} ${testName}`);
    if (details) console.log(`  ${colors.yellow}→${colors.reset} ${details}`);
    testsPassed++;
  } else {
    console.log(`${colors.red}✗ FAIL${colors.reset} ${testName}`);
    if (details) console.log(`  ${colors.red}→${colors.reset} ${details}`);
    testsFailed++;
  }
}

const runIntegrationTests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}🧪 PRUEBAS DE INTEGRACIÓN - TODOS LOS MÓDULOS${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

    // TEST 1: Modelo Sale - Generación de saleId
    console.log(`${colors.blue}📊 TEST 1: Modelo Sale - Generación de saleId${colors.reset}`);
    console.log('-'.repeat(80));
    
    const sales = await Sale.find().limit(5);
    const allHaveSaleId = sales.every(sale => sale.saleId && sale.saleId.match(/^VTA-\d{4}-\d{4}$/));
    testResult(
      allHaveSaleId,
      'Todas las ventas tienen saleId con formato VTA-YYYY-NNNN',
      `${sales.length} ventas verificadas`
    );

    // TEST 2: Modelo Sale - Cálculo de ganancias
    console.log(`\n${colors.blue}💰 TEST 2: Modelo Sale - Cálculo de ganancias${colors.reset}`);
    console.log('-'.repeat(80));
    
    const confirmedSales = await Sale.find({ paymentStatus: 'confirmado' }).limit(5);
    let profitCalculationsCorrect = true;
    
    confirmedSales.forEach(sale => {
      const expectedTotal = sale.adminProfit + sale.distributorProfit;
      if (Math.abs(expectedTotal - sale.totalProfit) > 0.1) {
        profitCalculationsCorrect = false;
      }
    });
    
    testResult(
      profitCalculationsCorrect,
      'Cálculo de ganancias correcto (totalProfit = adminProfit + distributorProfit)',
      `${confirmedSales.length} ventas verificadas`
    );

    // TEST 3: Modelo SpecialSale - Distribución de ganancias
    console.log(`\n${colors.blue}🌟 TEST 3: Ventas Especiales - Distribución${colors.reset}`);
    console.log('-'.repeat(80));
    
    const specialSales = await SpecialSale.find({ status: 'active' });
    let distributionCorrect = true;
    let totalDistributed = 0;
    
    specialSales.forEach(ss => {
      const sumDistribution = ss.distribution.reduce((sum, d) => sum + d.amount, 0);
      totalDistributed += sumDistribution;
      if (Math.abs(sumDistribution - ss.totalProfit) > 0.1) {
        distributionCorrect = false;
      }
    });
    
    testResult(
      distributionCorrect,
      'Suma de distribución coincide con totalProfit en cada venta especial',
      `${specialSales.length} ventas especiales, $${Math.round(totalDistributed).toLocaleString('es-CO')} distribuidos`
    );

    // TEST 4: Modelo Product - Integridad de datos
    console.log(`\n${colors.blue}📦 TEST 4: Productos - Integridad de datos${colors.reset}`);
    console.log('-'.repeat(80));
    
    const products = await Product.find();
    const allProductsValid = products.every(p => 
      p.purchasePrice > 0 && 
      p.distributorPrice > 0 && 
      p.distributorPrice >= p.purchasePrice
    );
    
    testResult(
      allProductsValid,
      'Todos los productos tienen precios válidos (distributorPrice >= purchasePrice > 0)',
      `${products.length} productos verificados`
    );

    // TEST 5: Modelo User - Distribuidores registrados
    console.log(`\n${colors.blue}👥 TEST 5: Usuarios - Distribuidores${colors.reset}`);
    console.log('-'.repeat(80));
    
    const distributors = await User.find({ role: 'distribuidor' });
    const allDistributorsValid = distributors.every(d => 
      d.name && d.email && d.password
    );
    
    testResult(
      allDistributorsValid,
      'Todos los distribuidores tienen campos requeridos (name, email, password)',
      `${distributors.length} distribuidores verificados`
    );

    // TEST 6: DistributorStock - Stock asignado
    console.log(`\n${colors.blue}📊 TEST 6: Stock de Distribuidores${colors.reset}`);
    console.log('-'.repeat(80));
    
    const distributorStocks = await DistributorStock.find()
      .populate('distributor', 'name')
      .populate('product', 'name');
    
    const allStocksValid = distributorStocks.every(stock => 
      stock.quantity >= 0 && 
      stock.distributor && 
      stock.product
    );
    
    testResult(
      allStocksValid,
      'Todos los stocks tienen cantidad válida (>= 0) y referencias correctas',
      `${distributorStocks.length} asignaciones de stock`
    );

    // TEST 7: Ventas normales vs especiales
    console.log(`\n${colors.blue}📈 TEST 7: Contabilidad General${colors.reset}`);
    console.log('-'.repeat(80));
    
    const normalSalesCount = await Sale.countDocuments({ paymentStatus: 'confirmado' });
    const specialSalesCount = specialSales.length;
    const totalSalesCount = normalSalesCount + specialSalesCount;
    
    testResult(
      totalSalesCount > 0,
      `Sistema tiene ventas registradas: ${normalSalesCount} normales + ${specialSalesCount} especiales = ${totalSalesCount} total`
    );

    // TEST 8: Ganancias totales del sistema
    console.log(`\n${colors.blue}💎 TEST 8: Ganancias Totales del Sistema${colors.reset}`);
    console.log('-'.repeat(80));
    
    const normalProfitAgg = await Sale.aggregate([
      { $match: { paymentStatus: 'confirmado' } },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: '$totalProfit' },
          totalRevenue: { $sum: { $multiply: ['$salePrice', '$quantity'] } }
        }
      }
    ]);
    
    const normalProfit = normalProfitAgg[0]?.totalProfit || 0;
    const normalRevenue = normalProfitAgg[0]?.totalRevenue || 0;
    const specialProfit = specialSales.reduce((sum, ss) => sum + ss.totalProfit, 0);
    const specialRevenue = specialSales.reduce((sum, ss) => sum + (ss.specialPrice * ss.quantity), 0);
    
    const totalProfit = normalProfit + specialProfit;
    const totalRevenue = normalRevenue + specialRevenue;
    
    testResult(
      totalProfit > 0 && totalRevenue > 0,
      'Sistema genera ganancias e ingresos',
      `Ganancias: $${Math.round(totalProfit).toLocaleString('es-CO')}, Ingresos: $${Math.round(totalRevenue).toLocaleString('es-CO')}`
    );
    
    testResult(
      totalRevenue >= totalProfit,
      'Los ingresos son mayores o iguales a las ganancias (lógica correcta)',
      `Margen: ${((totalProfit / totalRevenue) * 100).toFixed(2)}%`
    );

    // TEST 9: Verificar que no hay ventas con datos negativos
    console.log(`\n${colors.blue}🔍 TEST 9: Validación de Datos${colors.reset}`);
    console.log('-'.repeat(80));
    
    const negativeSales = await Sale.find({
      $or: [
        { totalProfit: { $lt: 0 } },
        { adminProfit: { $lt: 0 } },
        { quantity: { $lt: 1 } }
      ]
    });
    
    testResult(
      negativeSales.length === 0,
      'No hay ventas con datos negativos o inválidos',
      negativeSales.length > 0 ? `${negativeSales.length} ventas con problemas` : 'Todos los datos son válidos'
    );

    // TEST 10: Stock del sistema
    console.log(`\n${colors.blue}📦 TEST 10: Inventario del Sistema${colors.reset}`);
    console.log('-'.repeat(80));
    
    const totalProducts = await Product.countDocuments();
    const totalStock = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$totalStock' }
        }
      }
    ]);
    
    const stockAmount = totalStock[0]?.total || 0;
    
    testResult(
      stockAmount >= 0,
      'Inventario total del sistema es válido',
      `${totalProducts} productos, ${stockAmount} unidades totales`
    );

    // RESUMEN FINAL
    console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}📊 RESUMEN DE PRUEBAS DE INTEGRACIÓN${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.green}✓ Pruebas exitosas: ${testsPassed}${colors.reset}`);
    if (testsFailed > 0) {
      console.log(`${colors.red}✗ Pruebas fallidas: ${testsFailed}${colors.reset}`);
    }
    console.log(`Total: ${testsPassed + testsFailed} pruebas`);
    
    if (testsFailed === 0) {
      console.log(`\n${colors.green}🎉 ¡TODOS LOS MÓDULOS FUNCIONAN CORRECTAMENTE!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}⚠️  Algunos módulos necesitan atención${colors.reset}`);
    }

    await mongoose.connection.close();
    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error(`${colors.red}❌ Error ejecutando pruebas:${colors.reset}`, error);
    process.exit(1);
  }
};

runIntegrationTests();
