// Test de fechas
const now = new Date();
console.log("Fecha actual:", now);
console.log("Fecha actual (ISO):", now.toISOString());
console.log("Fecha actual (locale):", now.toLocaleString("es-CO"));
console.log("");

const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
console.log("startOfMonth:", startOfMonth);
console.log("startOfMonth (ISO):", startOfMonth.toISOString());
console.log("startOfMonth (locale):", startOfMonth.toLocaleString("es-CO"));
console.log("");

const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
console.log("endOfMonth:", endOfMonth);
console.log("endOfMonth (ISO):", endOfMonth.toISOString());
console.log("endOfMonth (locale):", endOfMonth.toLocaleString("es-CO"));
console.log("");

console.log("Verificación:");
console.log("now.getMonth():", now.getMonth(), "(0=enero, 10=noviembre)");
console.log("now.getMonth() + 1:", now.getMonth() + 1);
console.log("new Date(year, month+1, 0) da día:", new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
