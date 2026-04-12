import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import {
  getDashboardStats,
  getEmployeeEstimatedProfit,
  getEstimatedProfit,
} from "../controllers/AnalyticsController.js";

const router = express.Router();

// GET /api/v2/analytics/dashboard
router.get(
  "/dashboard",
  protect,
  businessContext,
  requireFeature("analytics"), // Assuming feature flag
  requirePermission({ module: "analytics", action: "read" }),
  getDashboardStats,
);

// GET /api/v2/analytics/estimated-profit
router.get(
  "/estimated-profit",
  protect,
  businessContext,
  requirePermission({ module: "analytics", action: "read" }),
  getEstimatedProfit,
);

// GET /api/v2/analytics/employee/estimated-profit
router.get(
  "/employee/estimated-profit",
  protect,
  businessContext,
  requirePermission({ module: "analytics", action: "read" }),
  getEmployeeEstimatedProfit,
);

export default router;
