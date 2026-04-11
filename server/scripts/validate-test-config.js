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
const safeTrim = (value) =>
  typeof value === "string" ? value.trim().replace(/^"|"$/g, "") : "";

const normalizeUri = (uri) => {
  const raw = safeTrim(uri);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const host = (parsed.hostname || "").toLowerCase();
    const port = parsed.port || "27017";
    const db = (parsed.pathname || "").replace(/^\/+/, "") || "admin";
    return `${host}:${port}/${db}`;
  } catch {
    return "";
  }
};

const testUri =
  process.env.MONGO_URI_TEST ||
  process.env.MONGODB_URI_TEST ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI;
const devUri = process.env.MONGO_URI_DEV || process.env.MONGO_URI_DEV_LOCAL;
const prodUri =
  process.env.MONGO_URI_PROD ||
  process.env.MONGODB_URI_PROD ||
  process.env.MONGO_URI_PROD_READ ||
  process.env.MONGODB_URI_PROD_READ;

if (!testUri) {
  console.error("❌ ERROR: MONGO_URI_TEST no está definida");
  errors++;
} else if (!testUri.includes("_test") && !testUri.includes("localhost")) {
  console.error(
    "❌ ERROR: Base de datos debe contener '_test' o ser localhost",
  );
  console.error(`   URI actual: ${testUri.substring(0, 60)}...`);
  errors++;
} else if (prodUri && normalizeUri(prodUri) === normalizeUri(testUri)) {
  console.error(
    "❌ ERROR: MONGO_URI_TEST coincide con URI de producción (bloqueado)",
  );
  errors++;
} else if (devUri && normalizeUri(devUri) === normalizeUri(testUri)) {
  console.error(
    "❌ ERROR: MONGO_URI_TEST coincide con URI de desarrollo (bloqueado)",
  );
  errors++;
} else {
  console.log("✅ Base de datos de test aislada correctamente");
}

// 3. Verificar puerto diferente
const port = process.env.PORT;
if (port === "5000") {
  console.warn(
    "⚠️  ADVERTENCIA: Puerto 5000 es el de producción, usar otro puerto para tests",
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
