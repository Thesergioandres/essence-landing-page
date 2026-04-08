import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { BusinessController } from "../controllers/BusinessController.js";
import DataExportController from "../controllers/DataExportController.js";

const router = Router();
const controller = new BusinessController();

router.post("/", protect, (req, res) => controller.create(req, res));
router.get("/my-memberships", protect, (req, res) =>
  controller.getMyMemberships(req, res),
);

// Full Data Export (JSON Backup) - Must be before /:id routes
router.get(
  "/export-full-data",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => DataExportController.exportFullData(req, res),
);

router.get("/", protect, (req, res) => controller.getAll(req, res));
router.get("/:id", protect, businessContext, (req, res) =>
  controller.getById(req, res),
);
router.put(
  "/:id",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.update(req, res),
);
router.put(
  "/:id/features",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.updateFeatures(req, res),
);
router.post(
  "/:id/members",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.addMember(req, res),
);
router.get(
  "/:id/members/find-user/:email",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.findUserByEmail(req, res),
);
router.put(
  "/:id/members/:membershipId",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.updateMember(req, res),
);
router.delete(
  "/:id/members/:membershipId",
  protect,
  businessContext,
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.removeMember(req, res),
);
router.get("/:id/members", protect, businessContext, (req, res) =>
  controller.getMembers(req, res),
);

export default router;
