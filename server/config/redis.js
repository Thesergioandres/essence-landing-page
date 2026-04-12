import Redis from "ioredis";

let redisClient = null;

const initRedis = () => {
  try {
    const redisEnabled = process.env.ENABLE_REDIS_CACHE === "true";

    // Si estÃ¡ deshabilitado explÃ­citamente o no hay URL, no iniciar
    if (!redisEnabled || !process.env.REDIS_URL) {
      console.warn("[Essence Debug]", "â„¹ï¸  Redis cache deshabilitado en este entorno");
      return null;
    }

    const redisUrl = process.env.REDIS_URL;

    // ConfiguraciÃ³n base de Redis
    const redisOptions = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    };

    // Agregar opciones TLS automÃ¡ticas si es un endpoint seguro (muy comÃºn en Railway y Upstash)
    if (redisUrl.startsWith("rediss://")) {
      redisOptions.tls = {
        rejectUnauthorized: false, // Permite certificados auto-firmados comunes en infraestructuras nativas de cloud
      };
    }

    redisClient = new Redis(redisUrl, redisOptions);

    redisClient.on("connect", () => {
      console.warn("[Essence Debug]", "âœ… Redis conectado exitosamente");
    });

    redisClient.on("error", (err) => {
      console.error("âŒ Redis error:", err.message);
    });

    return redisClient;
  } catch (error) {
    console.error("âŒ Error inicializando Redis:", error.message);
    return null;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = initRedis();
  }
  return redisClient;
};

export { getRedisClient, initRedis };

