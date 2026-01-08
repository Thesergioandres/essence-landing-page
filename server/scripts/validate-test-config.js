/**
 * Script de verificación pre-test
 * Se ejecuta antes de los tests para validar configuración segura
 */

import dotenv from "dotenv";

// Cargar .env.test
dotenv.config({ path: ".env.test" });

console.log("\n🔍 Verificando configuración de tests...\n");

let errors = 0;

// 1. Verificar NODE_ENV
if (process.env.NODE_ENV !== "test") {
  console.error("❌ ERROR: NODE_ENV debe ser 'test'");
  console.error(`   Valor actual: ${process.env.NODE_ENV}`);
  errors++;
} else {
  console.log("✅ NODE_ENV correcto: test");
}

// 2. Verificar base de datos
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ ERROR: MONGODB_URI no está definida");
  errors++;
} else if (!mongoUri.includes("_test") && !mongoUri.includes("localhost")) {
  console.error(
    "❌ ERROR: Base de datos debe contener '_test' o ser localhost"
  );
  console.error(`   URI actual: ${mongoUri.substring(0, 60)}...`);
  errors++;
} else {
  console.log("✅ Base de datos correcta: usa '_test'");
}

// 3. Verificar puerto diferente
const port = process.env.PORT;
if (port === "5000") {
  console.warn(
    "⚠️  ADVERTENCIA: Puerto 5000 es el de producción, usar otro puerto para tests"
  );
} else {
  console.log(`✅ Puerto correcto: ${port}`);
}

// 4. Verificar que .env.test existe
import fs from "fs";
if (!fs.existsSync(".env.test")) {
  console.error("❌ ERROR: Archivo .env.test no existe");
  errors++;
} else {
  console.log("✅ Archivo .env.test existe");
}

console.log("\n" + "=".repeat(50));

if (errors > 0) {
  console.error(`\n❌ ${errors} error(es) encontrado(s)`);
  console.error("   Los tests NO deben ejecutarse\n");
  process.exit(1);
} else {
  console.log("\n✅ Configuración de tests validada correctamente");
  console.log("   Es seguro ejecutar los tests\n");
  process.exit(0);
}
