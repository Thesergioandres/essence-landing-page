import express from "express";
import {
  createBusinessAssistantRecommendationsJob,
  getBusinessAssistantConfig,
  getBusinessAssistantRecommendations,
  getBusinessAssistantRecommendationsJob,
  updateBusinessAssistantConfig,
} from "../controllers/businessAssistant.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/recommendations",
  protect,
  admin,
  getBusinessAssistantRecommendations
);

router.get("/config", protect, admin, getBusinessAssistantConfig);
router.put("/config", protect, admin, updateBusinessAssistantConfig);

router.post(
  "/recommendations/jobs",
  protect,
  admin,
  createBusinessAssistantRecommendationsJob
);
router.get(
  "/recommendations/jobs/:id",
  protect,
  admin,
  getBusinessAssistantRecommendationsJob
);

export default router;
