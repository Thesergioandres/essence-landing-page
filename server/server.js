import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import swaggerUi from "swagger-ui-express";
import connectDB from "./config/database.js";
import { initRedis } from "./config/redis.js";
import swaggerSpec from "./config/swagger.config.js";
import { startBusinessAssistantWorker } from "./jobs/businessAssistant.worker.js";
import { startDebtNotificationWorker } from "./jobs/debtNotification.worker.js";
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import {
  apiLimiter,
  authLimiter,
  registerLimiter,
  uploadLimiter,
} from "./middleware/rateLimit.middleware.js";
import {
  requestIdMiddleware,
  withResponseRequestId,
} from "./middleware/requestId.middleware.js";
import { requestLogger } from "./middleware/requestLogger.middleware.js";

// Importar rutas
import {
  sanitizeHeaders,
  securityHeaders,
  suspiciousRequestDetector,
} from "./middleware/security.middleware.js";
import advancedAnalyticsRoutes from "./routes/advancedAnalytics.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import authRoutes from "./routes/auth.routes.js";
import branchRoutes from "./routes/branch.routes.js";
import branchTransferRoutes from "./routes/branchTransfer.routes.js";
import businessRoutes from "./routes/business.routes.js";
import businessAssistantRoutes from "./routes/businessAssistant.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import creditRoutes from "./routes/credit.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import customerPointsRoutes from "./routes/customerPoints.routes.js";
import defectiveProductRoutes from "./routes/defectiveProduct.routes.js";
import distributorRoutes from "./routes/distributor.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import gamificationRoutes from "./routes/gamification.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import issueRoutes from "./routes/issue.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import productRoutes from "./routes/product.routes.js";
import profitHistoryRoutes from "./routes/profitHistory.routes.js";
import promotionRoutes from "./routes/promotion.routes.js";
import providerRoutes from "./routes/provider.routes.js";
import pushSubscriptionRoutes from "./routes/pushSubscription.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import segmentRoutes from "./routes/segment.routes.js";
import specialSaleRoutes from "./routes/specialSale.routes.js";
import stockRoutes from "./routes/stock.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import userRoutes from "./routes/user.routes.js";

// Configuración
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configurar orígenes permitidos
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://93.189.89.195",
  "https://93.189.89.195",
];

// Conectar a MongoDB y Redis
await connectDB();
initRedis();

// Worker opcional para jobs (recomendaciones en background)
if (process.env.BA_ENABLE_WORKER === "true") {
  startBusinessAssistantWorker();
}

// Worker para notificaciones de deudas vencidas
if (process.env.DEBT_WORKER_ENABLED === "true") {
  startDebtNotificationWorker();
}

// Compression middleware (debe ir antes de las rutas)
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
  })
);

// RequestId + response injection
app.use(requestIdMiddleware);
app.use(withResponseRequestId);

// Middlewares de seguridad
app.use(securityHeaders);
app.use(sanitizeHeaders);
app.use(suspiciousRequestDetector);

// Aumentar límite de tamaño del body para imágenes Base64 (50MB)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Middlewares - CORS Configuration v5.0 - Enhanced for Production
app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Verificar si el origin está en la lista permitida
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === "string") {
          return allowed === origin;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.log("Origin bloqueado:", origin);
        callback(null, true); // Temporalmente permitir todos para debug
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-business-id",
      "X-Business-Id",
    ],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
    maxAge: 86400, // 24 horas de cache para preflight
  })
);

// Manejo explícito de preflight requests
app.options("*", cors());

// Logging de request/res con requestId
app.use(requestLogger);

// Rutas
app.get("/", (req, res) => {
  res.json({
    message: "Essence API funcionando correctamente",
    version: "2.0.0",
    cors: "enabled",
    docs: "/api-docs",
    timestamp: new Date().toISOString(),
  });
});

// Documentación Swagger
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Essence API Docs",
  })
);

// JSON de la especificación OpenAPI
app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Aplicar rate limiting global a la API (excepto auth que tiene su propio limiter)
app.use("/api", apiLimiter);

// Rutas de autenticación con rate limiting específico
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth", authRoutes);

app.use("/api/business", businessRoutes);
app.use("/api/business-assistant", businessAssistantRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/branch-transfers", branchTransferRoutes);
app.use("/api/upload", uploadLimiter, uploadRoutes);
app.use("/api/distributors", distributorRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/special-sales", specialSaleRoutes);
app.use("/api/defective-products", defectiveProductRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/advanced-analytics", advancedAnalyticsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/profit-history", profitHistoryRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/segments", segmentRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push", pushSubscriptionRoutes);
app.use("/api", customerPointsRoutes);

// Manejo global de errores
app.use(errorHandler);

export default app;

// Iniciar servidor (evitar escuchar en entorno de tests)
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });

  // Capturar errores no manejados
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
  });
}
