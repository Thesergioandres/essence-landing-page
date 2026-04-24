import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
  requireRole,
} from "../../../../middleware/business.middleware.js";
import {
  forceConsolidate,
  getConfig,
  getMyPoints,
  getPeriodHistory,
  getRanking,
  updateConfig,
} from "../controllers/GamificationController.js";

const router = Router();

router.use(protect, businessContext);

// Employee endpoints
router.get("/my-points", getMyPoints);
router.get("/ranking", getRanking);

// Admin endpoints
router.get(
  "/config",
  requireRole(["admin", "super_admin", "god"]),
  getConfig,
);
router.put(
  "/config",
  requireRole(["admin", "super_admin", "god"]),
  updateConfig,
);
router.get(
  "/history",
  requireRole(["admin", "super_admin", "god"]),
  getPeriodHistory,
);

// Super admin only
router.post(
  "/consolidate",
  requireRole(["super_admin", "god"]),
  forceConsolidate,
);

export default router;
