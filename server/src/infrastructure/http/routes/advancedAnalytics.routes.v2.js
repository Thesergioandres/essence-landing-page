import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { AdvancedAnalyticsController } from "../controllers/AdvancedAnalyticsController.js";

const router = Router();
const controller = new AdvancedAnalyticsController();

router.use(protect, businessContext);

router.get("/sales-summary", requirePermission("readAnalytics"), (req, res) =>
  controller.getSalesSummary(req, res),
);
router.get("/top-products", requirePermission("readAnalytics"), (req, res) =>
  controller.getTopProducts(req, res),
);
router.get(
  "/distributor-performance",
  requirePermission("readAnalytics"),
  (req, res) => controller.getDistributorPerformance(req, res),
);
router.get(
  "/inventory-status",
  requirePermission("readAnalytics"),
  (req, res) => controller.getInventoryStatus(req, res),
);
router.get("/credits-summary", requirePermission("readAnalytics"), (req, res) =>
  controller.getCreditsSummary(req, res),
);
router.get(
  "/expenses-summary",
  requirePermission("readAnalytics"),
  (req, res) => controller.getExpensesSummary(req, res),
);

export default router;
