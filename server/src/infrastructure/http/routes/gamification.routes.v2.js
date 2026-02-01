import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { GamificationController } from "../controllers/GamificationController.js";

const router = Router();
const controller = new GamificationController();

router.use(protect, businessContext, requireFeature("gamification"));

router.get("/commission/:distributorId", (req, res) =>
  controller.getAdjustedCommission(req, res),
);
router.post(
  "/check-period",
  requirePermission("manageGamification"),
  (req, res) => controller.checkAndEvaluatePeriod(req, res),
);
router.get("/config", requirePermission("manageGamification"), (req, res) =>
  controller.getConfig(req, res),
);
router.put("/config", requirePermission("manageGamification"), (req, res) =>
  controller.updateConfig(req, res),
);
router.get("/ranking", (req, res) => controller.getRanking(req, res));
router.get("/stats/:distributorId", (req, res) =>
  controller.getDistributorStats(req, res),
);

export default router;
