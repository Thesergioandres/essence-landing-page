import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { initRedis } from "./config/redis.js";
import swaggerSpec from "./config/swagger.config.js";
import { startBackupWorker } from "./jobs/backup.worker.js";
import { startBusinessAssistantWorker } from "./jobs/businessAssistant.worker.js";
import { startDebtNotificationWorker } from "./jobs/debtNotification.worker.js";
import { startDemoCleanupWorker } from "./jobs/demoCleanup.worker.js";
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import { financialShield } from "./middleware/financialShield.middleware.js";
import {
  apiLimiter,
  uploadLimiter,
} from "./middleware/rateLimit.middleware.js";
import {
  requestIdMiddleware,
  withResponseRequestId,
} from "./middleware/requestId.middleware.js";
import { requestLogger } from "./middleware/requestLogger.middleware.js";
import { connectDB } from "./src/infrastructure/database/connection.js";
import { listPublicPlans } from "./src/infrastructure/services/planLimits.service.js";

// ============================================================================
// 🛡️ MIDDLEWARE IMPORTS
// ============================================================================
import {
  databaseOperationLogger,
  productionWriteGuard,
  validateDatabaseSecurity,
} from "./middleware/databaseGuard.middleware.js";
import {
  sanitizeHeaders,
  securityHeaders,
  suspiciousRequestDetector,
} from "./middleware/security.middleware.js";

// ============================================================================
// 🟢 V2 CORE MODULES (Hexagonal Architecture)
// These routes use the new Domain → Application → Infrastructure pattern
// ============================================================================
import analyticsRoutesV2 from "./src/infrastructure/http/routes/analytics.routes.v2.js";
import authRoutesV2 from "./src/infrastructure/http/routes/auth.routes.v2.js";
import branchRoutesV2 from "./src/infrastructure/http/routes/branch.routes.v2.js";
import businessRoutesV2 from "./src/infrastructure/http/routes/business.routes.v2.js";
import businessAssistantRoutesV2 from "./src/infrastructure/http/routes/businessAssistant.routes.v2.js";
import categoryRoutesV2 from "./src/infrastructure/http/routes/category.routes.v2.js";
import creditRoutesV2 from "./src/infrastructure/http/routes/credit.routes.v2.js";
import customerRoutesV2 from "./src/infrastructure/http/routes/customer.routes.v2.js";
import distributorRoutesV2 from "./src/infrastructure/http/routes/distributor.routes.v2.js";
import expenseRoutesV2 from "./src/infrastructure/http/routes/expense.routes.v2.js";
import gamificationRoutesV2 from "./src/infrastructure/http/routes/gamification.routes.v2.js";
import globalSettingsRoutesV2 from "./src/infrastructure/http/routes/globalSettings.routes.v2.js";
import inventoryRoutesV2 from "./src/infrastructure/http/routes/inventory.routes.v2.js";
import productRoutesV2 from "./src/infrastructure/http/routes/product.routes.v2.js";
import providerRoutesV2 from "./src/infrastructure/http/routes/provider.routes.v2.js";
import publicDistributorRoutesV2 from "./src/infrastructure/http/routes/publicDistributor.routes.v2.js";
import saleRoutesV2 from "./src/infrastructure/http/routes/sales.routes.v2.js";
import stockRoutesV2 from "./src/infrastructure/http/routes/stock.routes.v2.js";
import userRoutesV2 from "./src/infrastructure/http/routes/user.routes.v2.js";

// ============================================================================
// � V2 BATCH 3 - UTILITIES & REPORTS (Hexagonal Architecture)
// ============================================================================
import advancedAnalyticsRoutesV2 from "./src/infrastructure/http/routes/advancedAnalytics.routes.v2.js";
import auditRoutesV2 from "./src/infrastructure/http/routes/audit.routes.v2.js";
import branchTransferRoutesV2 from "./src/infrastructure/http/routes/branchTransfer.routes.v2.js";
import defectiveProductRoutesV2 from "./src/infrastructure/http/routes/defectiveProduct.routes.v2.js";
import demoRoutesV2 from "./src/infrastructure/http/routes/demo.routes.v2.js";
import dispatchRoutesV2 from "./src/infrastructure/http/routes/dispatch.routes.v2.js";
import issueRoutesV2 from "./src/infrastructure/http/routes/issue.routes.v2.js";
import notificationRoutesV2 from "./src/infrastructure/http/routes/notification.routes.v2.js";
import promotionRoutesV2 from "./src/infrastructure/http/routes/promotion.routes.v2.js";
import specialSaleRoutesV2 from "./src/infrastructure/http/routes/specialSale.routes.v2.js";

// ============================================================================
// 🟢 V2 BATCH 4 - UTILITIES & CONFIG (Hexagonal Architecture)
// ============================================================================
import customerPointsRoutesV2 from "./src/infrastructure/http/routes/customerPoints.routes.v2.js";
import deliveryMethodRoutesV2 from "./src/infrastructure/http/routes/deliveryMethod.routes.v2.js";
import paymentMethodRoutesV2 from "./src/infrastructure/http/routes/paymentMethod.routes.v2.js";
import profitHistoryRoutesV2 from "./src/infrastructure/http/routes/profitHistory.routes.v2.js";
import pushSubscriptionRoutesV2 from "./src/infrastructure/http/routes/pushSubscription.routes.v2.js";
import segmentRoutesV2 from "./src/infrastructure/http/routes/segment.routes.v2.js";

// ============================================================================
// � V2 BATCH 5 - FINAL BOSS (Hexagonal Architecture - 100% Migration)
// ============================================================================
import godRoutesV2 from "./src/infrastructure/http/routes/god.routes.v2.js";
import uploadRoutesV2 from "./src/infrastructure/http/routes/upload.routes.v2.js";

// Configuración
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Configurar orígenes permitidos
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
];
const envOriginsRaw = process.env.ALLOWED_ORIGINS || "";
const envOrigins = envOriginsRaw
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const frontendOrigin = (process.env.FRONTEND_URL || "").trim();
const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...(frontendOrigin ? [frontendOrigin] : []),
  ...envOrigins,
];

// Conectar a MongoDB y Redis
await connectDB();
initRedis();

// 🔄 Sincronizar inventario al inicio (Single Source of Truth)
// import { syncAllProductStocks } from "./controllers/stock.controller.js";
// syncAllProductStocks().catch(console.error);

// 🛡️ Validar seguridad de base de datos antes de continuar
if (process.env.NODE_ENV === "development") {
  try {
    validateDatabaseSecurity();
  } catch (secError) {
    console.error(secError.message);
    process.exit(1);
  }
}

// Worker opcional para jobs (recomendaciones en background)
if (process.env.BA_ENABLE_WORKER === "true") {
  startBusinessAssistantWorker();
}

// Worker para notificaciones de deudas vencidas
if (process.env.DEBT_WORKER_ENABLED === "true") {
  startDebtNotificationWorker();
}

// Worker de backups automáticos (cada 6 horas, mantiene 30 días)
// Habilitado por defecto en desarrollo y producción, deshabilitado en tests
if (
  process.env.NODE_ENV !== "test" &&
  process.env.BACKUP_WORKER_DISABLED !== "true"
) {
  startBackupWorker();
}

if (process.env.NODE_ENV !== "test") {
  startDemoCleanupWorker();
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
  }),
);

// RequestId + response injection
app.use(requestIdMiddleware);
app.use(withResponseRequestId);

// Middlewares de seguridad
app.use(securityHeaders);
app.use(sanitizeHeaders);
app.use(suspiciousRequestDetector);

// 🛡️ Protección anti-escritura en producción
app.use(productionWriteGuard);
if (process.env.DEBUG_DB === "true") {
  app.use(databaseOperationLogger);
}

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
  }),
);

// Manejo explícito de preflight requests
app.options("*", cors());

// Logging de request/res con requestId
app.use(requestLogger);

// Blindaje financiero global: nullifica costos sensibles si el usuario no tiene view_costs
app.use(financialShield);

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
  }),
);

// JSON de la especificación OpenAPI
app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Aplicar rate limiting global a la API (excepto auth que tiene su propio limiter)
app.use("/api", apiLimiter);

// Endpoint público de configuración SaaS (sin autenticación)
app.get("/api/v2/global-settings/public", async (_req, res) => {
  try {
    const data = await listPublicPlans();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
//  V2 ROUTES (Hexagonal Architecture - Production Ready)
// ============================================================================
app.use("/api/v2/auth", authRoutesV2);
app.use("/api/v2/demo", demoRoutesV2);
app.use("/api/v2/branches", branchRoutesV2);
app.use("/api/v2/business", businessRoutesV2);
app.use("/api/v2/business-assistant", businessAssistantRoutesV2);
app.use("/api/v2/categories", categoryRoutesV2);
app.use("/api/v2/credits", creditRoutesV2);
app.use("/api/v2/customers", customerRoutesV2);
app.use("/api/v2/distributors", publicDistributorRoutesV2);
app.use("/api/v2/distributors", distributorRoutesV2);
app.use("/api/v2/expenses", expenseRoutesV2);
app.use("/api/v2/gamification", gamificationRoutesV2);
app.use("/api/v2/global-settings", globalSettingsRoutesV2);
app.use("/api/v2/inventory", inventoryRoutesV2);
app.use("/api/v2/products", productRoutesV2);
app.use("/api/v2/providers", providerRoutesV2);
app.use("/api/v2/sales", saleRoutesV2);
app.use("/api/v2/stock", stockRoutesV2);
app.use("/api/v2/analytics", analyticsRoutesV2);
app.use("/api/v2/users", userRoutesV2);

// ============================================================================
// � V2 BATCH 3 - UTILITIES & REPORTS
// ============================================================================
app.use("/api/v2/advanced-analytics", advancedAnalyticsRoutesV2);
app.use("/api/v2/audit", auditRoutesV2);
app.use("/api/v2/branch-transfers", branchTransferRoutesV2);
app.use("/api/v2/defective-products", defectiveProductRoutesV2);
app.use("/api/v2/dispatches", dispatchRoutesV2);
app.use("/api/v2/issues", issueRoutesV2);
app.use("/api/v2/notifications", notificationRoutesV2);
app.use("/api/v2/promotions", promotionRoutesV2);
app.use("/api/v2/special-sales", specialSaleRoutesV2);

// ============================================================================
// 🟢 V2 BATCH 4 - UTILITIES & CONFIG
// ============================================================================
app.use("/api/v2", customerPointsRoutesV2);
app.use("/api/v2/delivery-methods", deliveryMethodRoutesV2);
app.use("/api/v2/payment-methods", paymentMethodRoutesV2);
app.use("/api/v2/profit-history", profitHistoryRoutesV2);
app.use("/api/v2/push", pushSubscriptionRoutesV2);
app.use("/api/v2/segments", segmentRoutesV2);

// ============================================================================
// 🎯 V2 BATCH 5 - FINAL BOSS (100% Hexagonal Architecture Achieved)
// ============================================================================
app.use("/api/v2/god", godRoutesV2);
app.use("/api/v2/upload", uploadLimiter, uploadRoutesV2);

// ============================================================================
// 🎉 MIGRATION COMPLETE - All modules now use Hexagonal Architecture
// Legacy server/controllers and server/routes folders have been eliminated
// ============================================================================

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
