// Test de la solución CORRECTA
const now = new Date();
console.log("=== SERVIDOR (UTC) ===");
console.log("Hora UTC:", now.toISOString());
console.log("UTC getMonth():", now.getMonth(), "(11 = diciembre, ya pasó medianoche)");
console.log("UTC getDate():", now.getDate());
console.log("Offset servidor:", now.getTimezoneOffset(), "minutos (positivo = oeste de UTC)");
console.log("");

const colombiaOffset = 5 * 60; // UTC-5 significa restar 5 horas = +300 minutos desde UTC
const localOffset = now.getTimezoneOffset(); // En UTC esto es 0
const adjustment = (localOffset + colombiaOffset) * 60000;

console.log("=== CÁLCULO ===");
console.log("Local offset:", localOffset, "minutos");
console.log("Colombia offset:", colombiaOffset, "minutos (UTC-5)");
console.log("Ajuste total:", adjustment, "ms");
console.log("");

const colombiaTime = new Date(now.getTime() - adjustment);
console.log("=== COLOMBIA ===");
console.log("Hora Colombia:", colombiaTime.toISOString());
console.log("Colombia getMonth():", colombiaTime.getMonth(), "(10 = noviembre, todavía NO es dic)");
console.log("Colombia getDate():", colombiaTime.getDate());
console.log("");

const startOfMonth = new Date(colombiaTime.getFullYear(), colombiaTime.getMonth(), 1);
const endOfMonth = new Date(colombiaTime.getFullYear(), colombiaTime.getMonth() + 1, 0, 23, 59, 59);

console.log("=== RESULTADO FINAL ===");
console.log("Rango calculado:");
console.log("  Inicio:", startOfMonth.toISOString(), "->", startOfMonth.toLocaleString("es-CO"));
console.log("  Fin:", endOfMonth.toISOString(), "->", endOfMonth.toLocaleString("es-CO"));
console.log("");
console.log("✅ Debería mostrar: 1 noviembre - 30 noviembre");
