import express from "express";
import {
  getMonthlyProfit,
  getProfitByProduct,
  getProfitByDistributor,
  getAverages,
  getSalesTimeline,
  getFinancialSummary,
  getAnalyticsDashboard,
  getCombinedSummary,
} from "../controllers/analytics.controller.js";
import { protect, admin } from "../middleware/auth.middleware.js";
import { cacheMiddleware } from "../middleware/cache.middleware.js";

const router = express.Router();

// Caché de 5 minutos para analytics
router.get("/monthly-profit", protect, admin, cacheMiddleware(300, 'analytics'), getMonthlyProfit);
router.get("/profit-by-product", protect, admin, cacheMiddleware(300, 'analytics'), getProfitByProduct);
router.get("/profit-by-distributor", protect, admin, cacheMiddleware(300, 'analytics'), getProfitByDistributor);
router.get("/averages", protect, admin, cacheMiddleware(300, 'analytics'), getAverages);
router.get("/sales-timeline", protect, admin, cacheMiddleware(300, 'analytics'), getSalesTimeline);
router.get("/financial-summary", protect, admin, cacheMiddleware(300, 'analytics'), getFinancialSummary);
router.get("/dashboard", protect, admin, cacheMiddleware(300, 'analytics'), getAnalyticsDashboard);
router.get("/combined-summary", protect, admin, cacheMiddleware(300, 'analytics'), getCombinedSummary);

export default router;
