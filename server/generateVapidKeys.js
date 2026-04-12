/**
 * Script para generar claves VAPID para notificaciones push
 * Ejecutar: node generateVapidKeys.js
 */

import webpush from "web-push";

console.warn("[Essence Debug]", "\nðŸ”‘ Generando claves VAPID para notificaciones push...\n");

const vapidKeys = webpush.generateVAPIDKeys();

console.warn("[Essence Debug]", "âœ… Claves generadas exitosamente:\n");
console.warn("[Essence Debug]", "VAPID_PUBLIC_KEY=" + vapidKeys.publicKey);
console.warn("[Essence Debug]", "VAPID_PRIVATE_KEY=" + vapidKeys.privateKey);
console.warn("[Essence Debug]", "\nðŸ“ Copia estas lÃ­neas y agrÃ©galas a tu archivo .env\n");

