import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { AuditController } from "../controllers/AuditController.js";

const router = Router();
const controller = new AuditController();

router.use(protect, businessContext, requirePermission("readAudit"));

router.get("/logs", (req, res) => controller.getLogs(req, res));
router.get("/logs/:id", (req, res) => controller.getLogById(req, res));
router.get("/stats", (req, res) => controller.getStats(req, res));

export default router;
