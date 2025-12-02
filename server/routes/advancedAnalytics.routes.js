import express from "express";
import { protect, admin } from "../middleware/auth.middleware.js";
import {
  getSalesTimeline,
  getTopProducts,
  getSalesByCategory,
  getDistributorRankings,
  getLowStockVisual,
  getProductRotation,
  getFinancialKPIs,
  getComparativeAnalysis,
  getSalesFunnel
} from "../controllers/advancedAnalytics.controller.js";

const router = express.Router();

router.get("/sales-timeline", protect, admin, getSalesTimeline);
router.get("/top-products", protect, admin, getTopProducts);
router.get("/sales-by-category", protect, admin, getSalesByCategory);
router.get("/distributor-rankings", protect, admin, getDistributorRankings);
router.get("/low-stock-visual", protect, admin, getLowStockVisual);
router.get("/product-rotation", protect, admin, getProductRotation);
router.get("/financial-kpis", protect, admin, getFinancialKPIs);
router.get("/comparative", protect, admin, getComparativeAnalysis);
router.get("/sales-funnel", protect, admin, getSalesFunnel);

export default router;
