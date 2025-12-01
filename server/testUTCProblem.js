// Simular UTC time (como en Railway)
const nowUTC = new Date(); // En Railway esto sería 1 de diciembre UTC

console.log("=== SIMULACIÓN SERVIDOR RAILWAY (UTC) ===");
console.log("Hora UTC actual:", nowUTC.toISOString());
console.log("Hora local (Colombia):", nowUTC.toLocaleString("es-CO"));
console.log("nowUTC.getMonth():", nowUTC.getMonth(), "(esto es el problema!)");
console.log("");

// El servidor Railway lee getMonth() en UTC, que ya es diciembre
const month = nowUTC.getMonth(); // Devuelve 11 (diciembre) si UTC es 1 dic
const year = nowUTC.getFullYear();

const startOfMonth = new Date(year, month, 1);
const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

console.log("startOfMonth calculado:", startOfMonth.toISOString());
console.log("endOfMonth calculado:", endOfMonth.toISOString());
console.log("");

console.log("PROBLEMA:");
console.log("- En Colombia es 30 nov, 9:08 PM");
console.log("- En UTC es 1 dic, 2:08 AM");
console.log("- getMonth() lee el mes UTC (diciembre = 11)");
console.log("- Entonces calcula rango de DICIEMBRE, no NOVIEMBRE");
console.log("");

console.log("SOLUCIÓN:");
console.log("Usar timezone de Colombia o convertir fechas correctamente");
