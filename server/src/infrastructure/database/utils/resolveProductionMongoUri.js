const DEFAULT_DB_NAME = "essence";

const isMongoUri = (value = "") => /^mongodb(\+srv)?:\/\//i.test(value);

const safeTrim = (value) =>
  typeof value === "string" ? value.trim().replace(/^"|"$/g, "") : "";

const isRailwayInternalHost = (host = "") =>
  host === "mongodb.railway.internal" || host.endsWith(".railway.internal");

const isLikelyRailwayHttpDomain = (host = "") =>
  host.endsWith(".up.railway.app");

const runningInsideRailway = (env) =>
  Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID);

const appendDefaultDbAndReadPreference = (uri, dbName = DEFAULT_DB_NAME) => {
  try {
    const parsed = new URL(uri);

    const pathname = parsed.pathname || "";
    if (!pathname || pathname === "/") {
      parsed.pathname = `/${dbName}`;
    }

    if (!parsed.searchParams.has("readPreference")) {
      parsed.searchParams.set("readPreference", "secondaryPreferred");
    }

    if (!parsed.searchParams.has("retryWrites")) {
      parsed.searchParams.set("retryWrites", "false");
    }

    if (!parsed.searchParams.has("appName")) {
      parsed.searchParams.set("appName", "EssenceMirror");
    }

    return parsed.toString();
  } catch {
    return uri;
  }
};

const buildRailwayProxyUri = (env) => {
  const domain = safeTrim(env.RAILWAY_TCP_PROXY_DOMAIN);
  const port = safeTrim(env.RAILWAY_TCP_PROXY_PORT);
  const user =
    safeTrim(env.MONGOUSER) ||
    safeTrim(env.MONGO_INITDB_ROOT_USERNAME) ||
    safeTrim(env.MONGO_USERNAME);
  const password =
    safeTrim(env.MONGOPASSWORD) ||
    safeTrim(env.MONGO_INITDB_ROOT_PASSWORD) ||
    safeTrim(env.MONGO_PASSWORD);

  if (!domain || !port || !user || !password) {
    return "";
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `mongodb://${encodedUser}:${encodedPassword}@${domain}:${port}`;
};

/**
 * Resuelve la URI de la fuente de producción para sincronización espejo.
 * Prioridad:
 * 1) MONGO_URI_PROD / MONGODB_URI_PROD
 * 2) MONGO_PUBLIC_URL / RAILWAY_MONGO_PUBLIC_URL
 * 3) URI armada con RAILWAY_TCP_PROXY_DOMAIN + RAILWAY_TCP_PROXY_PORT + credenciales
 * 4) MONGO_URI_PROD_READ / MONGODB_URI_PROD_READ
 * 5) MONGO_URL (solo si corre dentro de Railway)
 */
export const resolveProductionMongoSource = (env = process.env) => {
  const warnings = [];
  const defaultDbName = safeTrim(env.MONGO_DB_NAME) || DEFAULT_DB_NAME;

  const candidates = [
    { source: "MONGO_URI_PROD", uri: safeTrim(env.MONGO_URI_PROD) },
    { source: "MONGODB_URI_PROD", uri: safeTrim(env.MONGODB_URI_PROD) },
    { source: "MONGO_PUBLIC_URL", uri: safeTrim(env.MONGO_PUBLIC_URL) },
    {
      source: "RAILWAY_MONGO_PUBLIC_URL",
      uri: safeTrim(env.RAILWAY_MONGO_PUBLIC_URL),
    },
    { source: "RAILWAY_TCP_PROXY", uri: buildRailwayProxyUri(env) },
    { source: "MONGO_URI_PROD_READ", uri: safeTrim(env.MONGO_URI_PROD_READ) },
    {
      source: "MONGODB_URI_PROD_READ",
      uri: safeTrim(env.MONGODB_URI_PROD_READ),
    },
    { source: "MONGO_URL", uri: safeTrim(env.MONGO_URL) },
  ];

  for (const candidate of candidates) {
    if (!candidate.uri || !isMongoUri(candidate.uri)) {
      continue;
    }

    try {
      const parsed = new URL(candidate.uri);
      const host = parsed.hostname || "";

      if (isRailwayInternalHost(host) && !runningInsideRailway(env)) {
        warnings.push(
          `${candidate.source} usa mongodb.railway.internal y no es accesible fuera de Railway. Configure MONGO_PUBLIC_URL o RAILWAY_TCP_PROXY_* para sincronizar desde local.`,
        );
        continue;
      }

      // Railway también genera dominios HTTP (*.up.railway.app) que no aceptan Mongo TCP.
      // Para mirror local solo sirve un dominio TCP proxy real.
      if (isLikelyRailwayHttpDomain(host)) {
        warnings.push(
          `${candidate.source} apunta a ${host}, que es un dominio HTTP de Railway y no un TCP proxy de Mongo. Configure RAILWAY_TCP_PROXY_DOMAIN/RAILWAY_TCP_PROXY_PORT (proxy real) para sincronizar desde local.`,
        );
        continue;
      }

      return {
        uri: appendDefaultDbAndReadPreference(candidate.uri, defaultDbName),
        source: candidate.source,
        warnings,
      };
    } catch {
      warnings.push(`URI inválida detectada en ${candidate.source}.`);
    }
  }

  warnings.push(
    "No se encontró URI de producción válida. Defina MONGO_URI_PROD, MONGO_PUBLIC_URL o RAILWAY_TCP_PROXY_DOMAIN/RAILWAY_TCP_PROXY_PORT.",
  );

  return {
    uri: null,
    source: null,
    warnings,
  };
};

export default resolveProductionMongoSource;
