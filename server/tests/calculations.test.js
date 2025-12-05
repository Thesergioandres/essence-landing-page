import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

// Colores para la consola
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

function assert(condition, testName, expected, actual) {
  if (condition) {
    console.log(`${colors.green}✓ PASS${colors.reset} ${testName}`);
    testsPassed++;
  } else {
    console.log(`${colors.red}✗ FAIL${colors.reset} ${testName}`);
    console.log(`  Expected: ${expected}`);
    console.log(`  Actual: ${actual}`);
    testsFailed++;
  }
}

function assertAlmostEqual(actual, expected, tolerance, testName) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`${colors.green}✓ PASS${colors.reset} ${testName}`);
    testsPassed++;
  } else {
    console.log(`${colors.red}✗ FAIL${colors.reset} ${testName}`);
    console.log(`  Expected: ${expected} (±${tolerance})`);
    console.log(`  Actual: ${actual}`);
    console.log(`  Difference: ${diff}`);
    testsFailed++;
  }
}

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`${colors.cyan}${'='.repeat(100)}${colors.reset}`);
    console.log(`${colors.cyan}🧪 EJECUTANDO PRUEBAS UNITARIAS - CÁLCULOS Y FILTROS${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(100)}${colors.reset}\n`);

    // TEST 1: Verificar cálculos de ganancias en ventas existentes
    console.log(`${colors.blue}📊 TEST 1: Verificar cálculos de ganancias${colors.reset}`);
    console.log('-'.repeat(100));
    
    const sales = await Sale.find({ paymentStatus: 'confirmado' }).limit(5);
    
    sales.forEach((sale, index) => {
      const expectedTotal = sale.adminProfit + sale.distributorProfit;
      const tolerance = 0.01; // Tolerancia de 1 centavo por redondeos
      
      assertAlmostEqual(
        sale.totalProfit,
        expectedTotal,
        tolerance,
        `Venta ${index + 1}: totalProfit = adminProfit + distributorProfit`
      );
      
      // Verificar que la ganancia del distribuidor sea correcta según el porcentaje
      if (sale.distributor) {
        const expectedDistProfit = (sale.salePrice * sale.distributorProfitPercentage / 100) * sale.quantity;
        assertAlmostEqual(
          sale.distributorProfit,
          expectedDistProfit,
          tolerance,
          `Venta ${index + 1}: distributorProfit = salePrice * ${sale.distributorProfitPercentage}% * quantity`
        );
        
        // Verificar ganancia admin
        const expectedAdminProfit = ((sale.salePrice - (sale.salePrice * sale.distributorProfitPercentage / 100) - sale.purchasePrice) * sale.quantity);
        assertAlmostEqual(
          sale.adminProfit,
          expectedAdminProfit,
          tolerance,
          `Venta ${index + 1}: adminProfit = (salePrice - distPortion - cost) * quantity`
        );
      } else {
        // Venta admin sin distribuidor
        const expectedAdminProfit = (sale.salePrice - sale.purchasePrice) * sale.quantity;
        assertAlmostEqual(
          sale.adminProfit,
          expectedAdminProfit,
          tolerance,
          `Venta admin ${index + 1}: adminProfit = (salePrice - cost) * quantity`
        );
        
        assert(
          sale.distributorProfit === 0,
          `Venta admin ${index + 1}: distributorProfit debe ser 0`,
          0,
          sale.distributorProfit
        );
      }
    });

    // TEST 2: Filtros de fecha con zona horaria Colombia
    console.log(`\n${colors.blue}🌎 TEST 2: Filtros de fecha con zona horaria Colombia${colors.reset}`);
    console.log('-'.repeat(100));
    
    const testDate = "2025-12-02";
    const startDate = new Date(testDate);
    const colombiaStartDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 5, 0, 0));
    const colombiaEndDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 1, 4, 59, 59, 999));
    
    assert(
      colombiaStartDate.toISOString() === '2025-12-02T05:00:00.000Z',
      'Inicio del día Colombia (00:00) = 05:00 UTC',
      '2025-12-02T05:00:00.000Z',
      colombiaStartDate.toISOString()
    );
    
    assert(
      colombiaEndDate.toISOString() === '2025-12-03T04:59:59.999Z',
      'Fin del día Colombia (23:59:59) = 04:59:59 UTC del día siguiente',
      '2025-12-03T04:59:59.999Z',
      colombiaEndDate.toISOString()
    );
    
    const todaySales = await Sale.find({
      saleDate: { $gte: colombiaStartDate, $lte: colombiaEndDate },
      paymentStatus: 'confirmado'
    });
    
    console.log(`  Ventas encontradas para ${testDate}: ${todaySales.length}`);
    
    // Verificar que todas las ventas encontradas estén dentro del rango
    let allInRange = true;
    todaySales.forEach(sale => {
      if (sale.saleDate < colombiaStartDate || sale.saleDate > colombiaEndDate) {
        allInRange = false;
      }
    });
    
    assert(
      allInRange,
      'Todas las ventas filtradas están dentro del rango de fechas',
      true,
      allInRange
    );

    // TEST 3: Agregación por producto
    console.log(`\n${colors.blue}📦 TEST 3: Agregación por producto${colors.reset}`);
    console.log('-'.repeat(100));
    
    const productAggregation = await Sale.aggregate([
      { $match: { paymentStatus: 'confirmado' } },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
        }
      },
      { $limit: 3 }
    ]);
    
    productAggregation.forEach((product, index) => {
      assert(
        product.totalQuantity > 0,
        `Producto ${index + 1}: totalQuantity > 0`,
        '> 0',
        product.totalQuantity
      );
      
      assert(
        product.totalRevenue > 0,
        `Producto ${index + 1}: totalRevenue > 0`,
        '> 0',
        product.totalRevenue
      );
      
      assert(
        product.totalSales > 0,
        `Producto ${index + 1}: totalSales > 0`,
        '> 0',
        product.totalSales
      );
    });

    // TEST 4: KPIs financieros - Mes actual
    console.log(`\n${colors.blue}💰 TEST 4: KPIs financieros del mes${colors.reset}`);
    console.log('-'.repeat(100));
    
    const now = new Date();
    const colombiaOffset = -5 * 60;
    const colombiaTime = new Date(now.getTime() + colombiaOffset * 60000);
    const startOfThisMonth = new Date(Date.UTC(colombiaTime.getUTCFullYear(), colombiaTime.getUTCMonth(), 1, 5, 0, 0, 0));
    
    const monthSales = await Sale.aggregate([
      { $match: { saleDate: { $gte: startOfThisMonth }, paymentStatus: 'confirmado' } },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          profit: { $sum: "$totalProfit" },
          sales: { $sum: 1 }
        }
      }
    ]);
    
    if (monthSales.length > 0) {
      const kpis = monthSales[0];
      
      assert(
        kpis.revenue >= kpis.profit,
        'Revenue >= Profit (los ingresos deben ser mayores o iguales a la ganancia)',
        `revenue >= profit`,
        `${kpis.revenue} >= ${kpis.profit}`
      );
      
      assert(
        kpis.sales > 0,
        'El mes actual tiene al menos 1 venta',
        '> 0',
        kpis.sales
      );
      
      const avgTicket = kpis.revenue / kpis.sales;
      assert(
        avgTicket > 0,
        'Ticket promedio > 0',
        '> 0',
        avgTicket
      );
      
      console.log(`  ${colors.yellow}ℹ${colors.reset} KPIs del mes: ${kpis.sales} ventas, $${kpis.revenue.toLocaleString('es-CO')} ingresos, $${kpis.profit.toLocaleString('es-CO')} ganancia`);
    }

    // TEST 5: Análisis comparativo mes actual vs anterior
    console.log(`\n${colors.blue}📈 TEST 5: Análisis comparativo (mes actual vs anterior)${colors.reset}`);
    console.log('-'.repeat(100));
    
    const thisMonthStart = new Date(Date.UTC(colombiaTime.getUTCFullYear(), colombiaTime.getUTCMonth(), 1, 5, 0, 0, 0));
    const lastMonthYear = colombiaTime.getUTCMonth() === 0 ? colombiaTime.getUTCFullYear() - 1 : colombiaTime.getUTCFullYear();
    const lastMonthNum = colombiaTime.getUTCMonth() === 0 ? 11 : colombiaTime.getUTCMonth() - 1;
    const lastMonthStart = new Date(Date.UTC(lastMonthYear, lastMonthNum, 1, 5, 0, 0, 0));
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
    
    const [lastMonth, thisMonth] = await Promise.all([
      Sale.aggregate([
        { $match: { saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd }, paymentStatus: 'confirmado' } },
        { $group: { _id: null, revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } }, profit: { $sum: "$totalProfit" }, sales: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        { $match: { saleDate: { $gte: thisMonthStart }, paymentStatus: 'confirmado' } },
        { $group: { _id: null, revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } }, profit: { $sum: "$totalProfit" }, sales: { $sum: 1 } } }
      ])
    ]);
    
    const lastMonthData = lastMonth[0] || { revenue: 0, profit: 0, sales: 0 };
    const thisMonthData = thisMonth[0] || { revenue: 0, profit: 0, sales: 0 };
    
    // Verificar que el cálculo de crecimiento sea correcto
    const revenueGrowth = lastMonthData.revenue > 0 
      ? ((thisMonthData.revenue - lastMonthData.revenue) / lastMonthData.revenue) * 100
      : thisMonthData.revenue > 0 ? 100 : 0;
    
    console.log(`  ${colors.yellow}ℹ${colors.reset} Mes anterior: ${lastMonthData.sales} ventas, $${lastMonthData.revenue.toLocaleString('es-CO')} ingresos`);
    console.log(`  ${colors.yellow}ℹ${colors.reset} Mes actual: ${thisMonthData.sales} ventas, $${thisMonthData.revenue.toLocaleString('es-CO')} ingresos`);
    console.log(`  ${colors.yellow}ℹ${colors.reset} Crecimiento: ${revenueGrowth.toFixed(2)}%`);
    
    assert(
      !isNaN(revenueGrowth),
      'El cálculo de crecimiento no produce NaN',
      'number',
      typeof revenueGrowth
    );

    // TEST 6: Verificar ventas de hoy específicamente
    console.log(`\n${colors.blue}📅 TEST 6: Ventas de hoy (2 dic 2025)${colors.reset}`);
    console.log('-'.repeat(100));
    
    const todayStart = new Date(Date.UTC(2025, 11, 2, 5, 0, 0)); // 2 dic 00:00 Colombia
    const todayEnd = new Date(Date.UTC(2025, 11, 3, 4, 59, 59, 999)); // 2 dic 23:59:59 Colombia
    
    const todaysSales = await Sale.find({
      saleDate: { $gte: todayStart, $lte: todayEnd },
      paymentStatus: 'confirmado'
    }).populate('product', 'name');
    
    let todayRevenue = 0;
    let todayProfit = 0;
    
    todaysSales.forEach(sale => {
      todayRevenue += sale.salePrice * sale.quantity;
      todayProfit += sale.totalProfit;
    });
    
    console.log(`  ${colors.yellow}ℹ${colors.reset} Ventas hoy: ${todaysSales.length}`);
    console.log(`  ${colors.yellow}ℹ${colors.reset} Ingresos hoy: $${todayRevenue.toLocaleString('es-CO')}`);
    console.log(`  ${colors.yellow}ℹ${colors.reset} Ganancia hoy: $${todayProfit.toLocaleString('es-CO')}`);
    
    todaysSales.forEach((sale, i) => {
      console.log(`    ${i+1}. ${sale.product?.name} - $${(sale.salePrice * sale.quantity).toLocaleString('es-CO')}`);
    });
    
    // Verificaciones esperadas para las 2 ventas de hoy
    assert(
      todaysSales.length === 2,
      'Hay exactamente 2 ventas confirmadas hoy (2 dic)',
      2,
      todaysSales.length
    );
    
    assertAlmostEqual(
      todayRevenue,
      72000,
      1,
      'Ingresos de hoy = $72,000 (Flamingo $50k + MTRX $22k)'
    );
    
    assertAlmostEqual(
      todayProfit,
      53000,
      1,
      'Ganancia de hoy = $53,000 ($41.5k + $11.5k)'
    );

    // RESUMEN
    console.log(`\n${colors.cyan}${'='.repeat(100)}${colors.reset}`);
    console.log(`${colors.cyan}📊 RESUMEN DE PRUEBAS${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(100)}${colors.reset}`);
    console.log(`${colors.green}✓ Pruebas exitosas: ${testsPassed}${colors.reset}`);
    if (testsFailed > 0) {
      console.log(`${colors.red}✗ Pruebas fallidas: ${testsFailed}${colors.reset}`);
    }
    console.log(`Total: ${testsPassed + testsFailed} pruebas`);
    
    if (testsFailed === 0) {
      console.log(`\n${colors.green}🎉 ¡TODOS LOS CÁLCULOS SON CORRECTOS!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}⚠️  Algunos cálculos necesitan revisión${colors.reset}`);
    }
    
    await mongoose.connection.close();
    process.exit(testsFailed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`${colors.red}❌ Error ejecutando pruebas:${colors.reset}`, error);
    process.exit(1);
  }
}

runTests();
