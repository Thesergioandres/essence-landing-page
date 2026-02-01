import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { getDashboardStats } from "../controllers/AnalyticsController.js";

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

export default router;
