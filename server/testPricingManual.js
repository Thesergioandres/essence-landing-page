// Prueba manual con posiciones fijas
const testManual = () => {
  const purchasePrice = 20000;

  console.log("=== SISTEMA DE PRECIOS POR RANKING (MANUAL) ===\n");
  console.log(`Precio de compra: $${purchasePrice.toLocaleString()}\n`);

  const rankings = [
    { position: 1, percentage: 25, name: "🥇 1er Lugar" },
    { position: 2, percentage: 23, name: "🥈 2do Lugar" },
    { position: 3, percentage: 21, name: "🥉 3er Lugar" },
    { position: 4, percentage: 20, name: "#4 y resto" },
  ];

  for (const rank of rankings) {
    // Formula: precio = costo / (1 - porcentaje/100)
    const price = Math.round(purchasePrice / (1 - rank.percentage / 100));
    const profit = price - purchasePrice;
    const distGain = Math.round(price * rank.percentage / 100);
    const adminReceives = price - distGain;
    const adminProfit = adminReceives - purchasePrice;

    console.log(`${rank.name} (${rank.percentage}% ganancia)`);
    console.log(`   Precio de venta: $${price.toLocaleString()}`);
    console.log(`   Ganancia distribuidor: $${distGain.toLocaleString()} (${rank.percentage}%)`);
    console.log(`   Envía al admin: $${adminReceives.toLocaleString()}`);
    console.log(`   Ganancia admin: $${adminProfit.toLocaleString()}`);
    console.log("");
  }

  console.log("\n💡 FUNCIONAMIENTO:");
  console.log("- Cada distribuidor tiene un precio de venta diferente según su posición");
  console.log("- El distribuidor cobra su precio y se queda con su porcentaje");
  console.log("- Envía el resto al admin (que cubre el costo + ganancia admin)");
  console.log("- NO hay devoluciones, cada uno gana lo correcto automáticamente");
};

testManual();
