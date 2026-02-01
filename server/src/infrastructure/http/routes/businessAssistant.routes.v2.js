import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { BusinessAssistantController } from "../controllers/BusinessAssistantController.js";

const router = Router();
const controller = new BusinessAssistantController();

router.use(protect, businessContext, requireFeature("businessAssistant"));

router.get(
  "/config",
  requirePermission("manageBusinessAssistant"),
  (req, res) => controller.getConfig(req, res),
);
router.put(
  "/config",
  requirePermission("manageBusinessAssistant"),
  (req, res) => controller.updateConfig(req, res),
);
router.get("/recommendations", (req, res) =>
  controller.generateRecommendations(req, res),
);
router.post("/ask", (req, res) => controller.askAssistant(req, res));

export default router;
