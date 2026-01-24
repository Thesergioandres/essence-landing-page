import express from "express";
import {
  createBusinessAssistantRecommendationsJob,
  getBusinessAssistantConfig,
  getBusinessAssistantRecommendations,
  getBusinessAssistantRecommendationsJob,
  getLatestAnalysis,
  getStrategicAnalysis,
  updateBusinessAssistantConfig,
} from "../controllers/businessAssistant.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

router.use(protect, businessContext);

router.get(
  "/recommendations",
  requirePermission({ module: "config", action: "read" }),
  getBusinessAssistantRecommendations,
);

router.get(
  "/config",
  requirePermission({ module: "config", action: "read" }),
  getBusinessAssistantConfig,
);
router.put(
  "/config",
  requirePermission({ module: "config", action: "update" }),
  updateBusinessAssistantConfig,
);

router.post(
  "/recommendations/jobs",
  requirePermission({ module: "config", action: "create" }),
  createBusinessAssistantRecommendationsJob,
);
// Route for Project CEO - MUST be before /:id routes if any exist
router.get(
  "/recommendations/jobs/latest",
  requirePermission({ module: "config", action: "read" }),
  getLatestAnalysis,
);

router.get(
  "/latest",
  requirePermission({ module: "config", action: "read" }),
  getLatestAnalysis,
);
router.get(
  "/recommendations/jobs/:id",
  requirePermission({ module: "config", action: "read" }),
  getBusinessAssistantRecommendationsJob,
);

router.post(
  "/analyze",
  requirePermission({ module: "config", action: "read" }),
  getStrategicAnalysis,
);
router.post(
  "/analyze-strategic",
  requirePermission({ module: "config", action: "read" }),
  getStrategicAnalysis,
);

export default router;
