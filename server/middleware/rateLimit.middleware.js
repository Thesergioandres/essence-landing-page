import rateLimit from "express-rate-limit";
import { logApiWarn } from "../utils/logger.js";

// Helper para generar keys con soporte IPv6
const ipKeyGenerator = (req) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  // Normalizar IPv6
  return ip.replace(/^::ffff:/, "");
};

/**
 * Rate Limiter para endpoints de autenticación
 * Más restrictivo para prevenir ataques de fuerza bruta
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por ventana
  message: {
    message:
      "Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.",
    code: "RATE_LIMIT_AUTH",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Omitir rate limiting en tests
    return process.env.NODE_ENV === "test";
  },
  handler: (req, res, next, options) => {
    logApiWarn({
      message: "Rate limit exceeded - auth",
      module: "rateLimit",
      requestId: req.reqId,
      extra: {
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
    });
    res.status(429).json(options.message);
  },
  keyGenerator: (req) => {
    // Usar helper de IPv6 + email si está disponible
    const email = req.body?.email || "";
    return email ? `${ipKeyGenerator(req)}-${email}` : ipKeyGenerator(req);
  },
});

/**
 * Rate Limiter general para API
 * Menos restrictivo, para uso normal
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto
  message: {
    message: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
    code: "RATE_LIMIT_API",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Omitir rate limiting en tests
    return process.env.NODE_ENV === "test";
  },
  handler: (req, res, next, options) => {
    logApiWarn({
      message: "Rate limit exceeded - api",
      module: "rateLimit",
      requestId: req.reqId,
      extra: {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
      },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Rate Limiter para uploads
 * Muy restrictivo por el tamaño de las peticiones
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 uploads por hora
  message: {
    message: "Límite de uploads alcanzado. Intenta de nuevo más tarde.",
    code: "RATE_LIMIT_UPLOAD",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logApiWarn({
      message: "Rate limit exceeded - upload",
      module: "rateLimit",
      requestId: req.reqId,
      extra: {
        ip: req.ip,
        userId: req.user?.id,
      },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Rate Limiter para registro de usuarios
 * Previene creación masiva de cuentas
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 registros por hora por IP
  message: {
    message: "Demasiados registros desde esta IP. Intenta de nuevo más tarde.",
    code: "RATE_LIMIT_REGISTER",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logApiWarn({
      message: "Rate limit exceeded - register",
      module: "rateLimit",
      requestId: req.reqId,
      extra: {
        ip: req.ip,
        email: req.body?.email,
      },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Rate Limiter para endpoints sensibles (GOD panel, etc.)
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 requests por 5 minutos
  message: {
    message: "Acceso restringido temporalmente por exceso de solicitudes.",
    code: "RATE_LIMIT_SENSITIVE",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logApiWarn({
      message: "Rate limit exceeded - sensitive",
      module: "rateLimit",
      requestId: req.reqId,
      extra: {
        ip: req.ip,
        path: req.path,
        userId: req.user?.id,
      },
    });
    res.status(429).json(options.message);
  },
});
