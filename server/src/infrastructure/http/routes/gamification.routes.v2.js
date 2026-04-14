import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { GamificationController } from "../controllers/GamificationController.js";

const router = Router();
const controller = new GamificationController();

router.use(protect, businessContext, requireFeature("gamification"));

router.get("/commission/:employeeId", (req, res) =>
  controller.getAdjustedCommission(req, res),
);
router.post(
  "/check-period",
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.checkAndEvaluatePeriod(req, res),
);
router.get("/config", (req, res) => controller.getConfig(req, res));
router.put(
  "/config",
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.updateConfig(req, res),
);
router.get("/ranking", (req, res) => controller.getRanking(req, res));
router.get(
  "/winners",
  requirePermission({ module: "config", action: "read" }),
  (req, res) => controller.getWinners(req, res),
);
router.put(
  "/winners/:id/pay",
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.markBonusPaid(req, res),
);
router.get("/stats/:employeeId", (req, res) =>
  controller.getEmployeeStats(req, res),
);
router.post(
  "/recalculate-points",
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.recalculatePoints(req, res),
);

export default router;
