import express from "express";
import {
  getAnalyticsDashboard,
  getAverages,
  getCombinedSummary,
  getDistributorEstimatedProfit,
  getEstimatedProfit,
  getFinancialSummary,
  getMonthlyProfit,
  getPaymentMethodMetrics,
  getProfitByDistributor,
  getProfitByProduct,
  getSalesTimeline,
} from "../controllers/analytics.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";
import { cacheMiddleware } from "../middleware/cache.middleware.js";

// Solo usar caché si está habilitado en entorno
const cacheIfEnabled =
  process.env.ENABLE_REDIS_CACHE === "true"
    ? cacheMiddleware(300, "analytics")
    : (req, res, next) => next();

const router = express.Router();

// Caché de 5 minutos para analytics (scoped por negocio)
router.use(
  protect,
  businessContext,
  requireFeature("analytics"),
  requirePermission({ module: "analytics", action: "read" })
);

router.get("/monthly-profit", cacheIfEnabled, getMonthlyProfit);
router.get("/profit-by-product", cacheIfEnabled, getProfitByProduct);
router.get("/profit-by-distributor", cacheIfEnabled, getProfitByDistributor);
router.get("/averages", cacheIfEnabled, getAverages);
router.get("/sales-timeline", cacheIfEnabled, getSalesTimeline);
router.get("/financial-summary", cacheIfEnabled, getFinancialSummary);
router.get("/dashboard", cacheIfEnabled, getAnalyticsDashboard);
router.get("/combined-summary", cacheIfEnabled, getCombinedSummary);
router.get("/payment-methods", cacheIfEnabled, getPaymentMethodMetrics);
router.get("/estimated-profit", cacheIfEnabled, getEstimatedProfit);
router.get(
  "/estimated-profit/distributor/:distributorId",
  cacheIfEnabled,
  getDistributorEstimatedProfit
);

export default router;
