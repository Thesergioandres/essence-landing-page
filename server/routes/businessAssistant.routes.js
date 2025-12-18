import express from "express";
import { getBusinessAssistantRecommendations } from "../controllers/businessAssistant.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/recommendations",
  protect,
  admin,
  getBusinessAssistantRecommendations
);

export default router;
