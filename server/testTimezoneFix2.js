// Test de la solución de timezone mejorada
const now = new Date();
console.log("Hora UTC servidor:", now.toISOString());
console.log("UTC getMonth():", now.getMonth());
console.log("UTC getDate():", now.getDate());
console.log("");

const colombiaOffset = -5 * 60; // Colombia es UTC-5 (en minutos)
const localOffset = now.getTimezoneOffset(); // Diferencia del servidor con UTC
console.log("Offset local (minutos desde UTC):", localOffset);
console.log("Offset Colombia (minutos desde UTC):", colombiaOffset);
console.log("");

const colombiaTime = new Date(now.getTime() + (localOffset - colombiaOffset) * 60000);
console.log("Hora Colombia ajustada:", colombiaTime.toISOString());
console.log("Colombia getMonth():", colombiaTime.getMonth());
console.log("Colombia getDate():", colombiaTime.getDate());
console.log("");

const startOfMonth = new Date(colombiaTime.getFullYear(), colombiaTime.getMonth(), 1);
const endOfMonth = new Date(colombiaTime.getFullYear(), colombiaTime.getMonth() + 1, 0, 23, 59, 59);

console.log("RESULTADO:");
console.log("Inicio mes:", startOfMonth.toISOString());
console.log("Fin mes:", endOfMonth.toISOString());
console.log("");
console.log("En formato local Colombia:");
console.log("Inicio:", startOfMonth.toLocaleString("es-CO"));
console.log("Fin:", endOfMonth.toLocaleString("es-CO"));
