// Test de la solución timezone
const nowUTC = new Date();
console.log("Hora UTC:", nowUTC.toISOString());
console.log("getMonth() UTC:", nowUTC.getMonth(), "(puede ser diciembre)");
console.log("");

const nowColombia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
console.log("Hora Colombia convertida:", nowColombia.toISOString());
console.log("getMonth() Colombia:", nowColombia.getMonth(), "(debería ser noviembre)");
console.log("");

const startOfMonth = new Date(nowColombia.getFullYear(), nowColombia.getMonth(), 1);
const endOfMonth = new Date(nowColombia.getFullYear(), nowColombia.getMonth() + 1, 0, 23, 59, 59);

console.log("Inicio mes actual:", startOfMonth.toISOString());
console.log("Fin mes actual:", endOfMonth.toISOString());
console.log("");
console.log("VERIFICACIÓN:");
console.log("- Debería mostrar rango de NOVIEMBRE (mes 10)");
console.log("- Inicio: 1 de noviembre");
console.log("- Fin: 30 de noviembre");
