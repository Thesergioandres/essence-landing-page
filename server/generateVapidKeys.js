/**
 * Script para generar claves VAPID para notificaciones push
 * Ejecutar: node generateVapidKeys.js
 */

import webpush from "web-push";

console.log("\n🔑 Generando claves VAPID para notificaciones push...\n");

const vapidKeys = webpush.generateVAPIDKeys();

console.log("✅ Claves generadas exitosamente:\n");
console.log("VAPID_PUBLIC_KEY=" + vapidKeys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + vapidKeys.privateKey);
console.log("\n📝 Copia estas líneas y agrégalas a tu archivo .env\n");
