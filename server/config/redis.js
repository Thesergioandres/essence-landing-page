import Redis from 'ioredis';

let redisClient = null;

const initRedis = () => {
  try {
    // Si no hay REDIS_URL, usar modo desarrollo (memoria)
    if (!process.env.REDIS_URL) {
      console.log('⚠️  Redis no configurado - Cache deshabilitado en desarrollo');
      return null;
    }

    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis conectado exitosamente');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Error inicializando Redis:', error.message);
    return null;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = initRedis();
  }
  return redisClient;
};

export { initRedis, getRedisClient };
