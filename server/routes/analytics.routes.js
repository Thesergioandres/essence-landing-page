import express from "express";
import {
  getMonthlyProfit,
  getProfitByProduct,
  getProfitByDistributor,
  getAverages,
  getSalesTimeline,
  getFinancialSummary,
  getAnalyticsDashboard,
} from "../controllers/analytics.controller.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/monthly-profit", protect, admin, getMonthlyProfit);
router.get("/profit-by-product", protect, admin, getProfitByProduct);
router.get("/profit-by-distributor", protect, admin, getProfitByDistributor);
router.get("/averages", protect, admin, getAverages);
router.get("/sales-timeline", protect, admin, getSalesTimeline);
router.get("/financial-summary", protect, admin, getFinancialSummary);
router.get("/dashboard", protect, admin, getAnalyticsDashboard);

export default router;
