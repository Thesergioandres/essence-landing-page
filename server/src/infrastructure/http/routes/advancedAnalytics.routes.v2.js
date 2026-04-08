import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { AdvancedAnalyticsController } from "../controllers/AdvancedAnalyticsController.js";

const router = Router();
const controller = new AdvancedAnalyticsController();

router.use(protect, businessContext);

// Financial KPIs - Main dashboard endpoint
router.get(
  "/financial-kpis",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getFinancialKPIs(req, res),
);

// Sales funnel
router.get(
  "/sales-funnel",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getSalesFunnel(req, res),
);

// Sales timeline
router.get(
  "/sales-timeline",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getSalesTimeline(req, res),
);

// Comparative analysis
router.get(
  "/comparative-analysis",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getComparativeAnalysis(req, res),
);

// Alias for frontend compatibility
router.get(
  "/comparative",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getComparativeAnalysis(req, res),
);

// Sales by category
router.get(
  "/sales-by-category",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getSalesByCategory(req, res),
);

// Product rotation
router.get(
  "/product-rotation",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getProductRotation(req, res),
);

// Distributor rankings
router.get(
  "/distributor-rankings",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getDistributorRankings(req, res),
);

// Low stock visual
router.get(
  "/low-stock-visual",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getLowStockVisual(req, res),
);

router.get(
  "/sales-summary",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getSalesSummary(req, res),
);
router.get(
  "/top-products",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getTopProducts(req, res),
);
router.get(
  "/distributor-performance",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getDistributorPerformance(req, res),
);
router.get(
  "/inventory-status",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getInventoryStatus(req, res),
);
router.get(
  "/credits-summary",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getCreditsSummary(req, res),
);
router.get(
  "/expenses-summary",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => controller.getExpensesSummary(req, res),
);

export default router;
