import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { AuditController } from "../controllers/AuditController.js";

const router = Router();
const controller = new AuditController();

router.use(
  protect,
  businessContext,
  requirePermission({ module: "config", action: "read" }),
);

router.get("/logs", (req, res) => controller.getLogs(req, res));
router.get("/logs/:id", (req, res) => controller.getLogById(req, res));
router.get("/summary/daily", (req, res) =>
  controller.getDailySummary(req, res),
);
router.get("/stats", (req, res) => controller.getStats(req, res));

export default router;
