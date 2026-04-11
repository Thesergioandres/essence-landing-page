import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const originalEmitWarning = process.emitWarning.bind(process);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.test") });

const safeTrim = (value) =>
  typeof value === "string" ? value.trim().replace(/^"|"$/g, "") : "";

const resolveFirst = (...values) => {
  for (const value of values) {
    const normalized = safeTrim(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const normalizeUri = (uri) => {
  const raw = safeTrim(uri);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const host = (parsed.hostname || "").toLowerCase();
    const port = parsed.port || "27017";
    const dbName = (parsed.pathname || "").replace(/^\/+/, "") || "admin";
    return `${host}:${port}/${dbName}`;
  } catch {
    return "";
  }
};

const TEST_URI = resolveFirst(
  process.env.MONGO_URI_TEST,
  process.env.MONGODB_URI_TEST,
  process.env.MONGODB_URI,
  process.env.MONGO_URI,
  "mongodb://127.0.0.1:27017/essence_test",
);

const DEV_URI = resolveFirst(
  process.env.MONGO_URI_DEV,
  process.env.MONGO_URI_DEV_LOCAL,
);

const PROD_URI = resolveFirst(
  process.env.MONGO_URI_PROD,
  process.env.MONGODB_URI_PROD,
  process.env.MONGO_URI_PROD_READ,
  process.env.MONGODB_URI_PROD_READ,
);

if (!TEST_URI) {
  throw new Error("[TEST SAFETY] MONGO_URI_TEST no está configurada");
}

if (PROD_URI && normalizeUri(PROD_URI) === normalizeUri(TEST_URI)) {
  throw new Error(
    "[TEST SAFETY] MONGO_URI_TEST coincide con URI de producción. Abortando tests.",
  );
}

if (DEV_URI && normalizeUri(DEV_URI) === normalizeUri(TEST_URI)) {
  throw new Error(
    "[TEST SAFETY] MONGO_URI_TEST coincide con URI de desarrollo. Abortando tests.",
  );
}

process.env.NODE_ENV = "test";
process.env.MONGO_URI_TEST = TEST_URI;
process.env.MONGODB_URI_TEST = TEST_URI;
process.env.MONGO_URI = TEST_URI;
process.env.MONGODB_URI = TEST_URI;

process.emitWarning = (warning, ...args) => {
  const message =
    typeof warning === "string"
      ? warning
      : warning && typeof warning.message === "string"
        ? warning.message
        : "";

  if (message.includes("--localstorage-file")) {
    return;
  }

  return originalEmitWarning(warning, ...args);
};
