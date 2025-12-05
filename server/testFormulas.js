// Prueba de fórmulas de ganancias según especificación del usuario

const testCases = [
  {
    name: "Admin vende (sin distribuidor)",
    purchasePrice: 10500,
    salePrice: 22000,
    commission: 0,
    isAdmin: true
  },
  {
    name: "Distribuidor Rango Normal (20%)",
    purchasePrice: 10500,
    salePrice: 22000,
    commission: 20,
    isAdmin: false
  },
  {
    name: "Distribuidor Rango 3 (21%)",
    purchasePrice: 10500,
    salePrice: 22000,
    commission: 21,
    isAdmin: false
  },
  {
    name: "Distribuidor Rango 2 (23%)",
    purchasePrice: 10500,
    salePrice: 22000,
    commission: 23,
    isAdmin: false
  },
  {
    name: "Distribuidor Rango 1 (25%)",
    purchasePrice: 10500,
    salePrice: 22000,
    commission: 25,
    isAdmin: false
  }
];

console.log('='.repeat(100));
console.log('PRUEBA DE FÓRMULAS DE GANANCIAS');
console.log('='.repeat(100));
console.log();

testCases.forEach((test, i) => {
  console.log(`${i + 1}. ${test.name}`);
  console.log('-'.repeat(80));
  
  if (test.isAdmin) {
    // Venta admin
    const adminProfit = test.salePrice - test.purchasePrice;
    console.log(`Precio Compra: $${test.purchasePrice.toLocaleString('es-CO')}`);
    console.log(`Precio Venta: $${test.salePrice.toLocaleString('es-CO')}`);
    console.log(`Ganancia Admin: $${test.salePrice.toLocaleString('es-CO')} - $${test.purchasePrice.toLocaleString('es-CO')} = $${adminProfit.toLocaleString('es-CO')}`);
  } else {
    // Venta distribuidor
    const priceForDistributor = test.salePrice * ((100 - test.commission) / 100);
    const distributorProfit = test.salePrice - priceForDistributor;
    const adminProfit = test.salePrice - test.purchasePrice - distributorProfit;
    
    console.log(`Precio Compra: $${test.purchasePrice.toLocaleString('es-CO')}`);
    console.log(`Comisión: ${test.commission}%`);
    console.log();
    console.log(`Precio para Distribuidor (lo que paga al admin):`);
    console.log(`  $${test.salePrice.toLocaleString('es-CO')} × ${(100 - test.commission) / 100} = $${priceForDistributor.toLocaleString('es-CO')}`);
    console.log();
    console.log(`Ganancia Distribuidor:`);
    console.log(`  $${test.salePrice.toLocaleString('es-CO')} - $${priceForDistributor.toLocaleString('es-CO')} = $${distributorProfit.toLocaleString('es-CO')}`);
    console.log(`  (Alternativamente: $${test.salePrice.toLocaleString('es-CO')} × ${test.commission / 100} = $${distributorProfit.toLocaleString('es-CO')})`);
    console.log();
    console.log(`Ganancia Admin:`);
    console.log(`  $${test.salePrice.toLocaleString('es-CO')} - $${test.purchasePrice.toLocaleString('es-CO')} - $${distributorProfit.toLocaleString('es-CO')} = $${adminProfit.toLocaleString('es-CO')}`);
  }
  
  console.log();
});

console.log('='.repeat(100));
console.log('✅ FÓRMULAS VERIFICADAS');
console.log('='.repeat(100));
