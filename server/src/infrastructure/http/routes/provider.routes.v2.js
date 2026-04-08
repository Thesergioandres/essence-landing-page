import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { ProviderController } from "../controllers/ProviderController.js";

const router = Router();
const controller = new ProviderController();

router.use(protect, businessContext, requireFeature("inventory"));

router.post(
  "/",
  requirePermission({ module: "providers", action: "create" }),
  (req, res) => controller.create(req, res),
);
router.get(
  "/",
  requirePermission({ module: "providers", action: "read" }),
  (req, res) => controller.getAll(req, res),
);
router.get(
  "/:id",
  requirePermission({ module: "providers", action: "read" }),
  (req, res) => controller.getById(req, res),
);
router.put(
  "/:id",
  requirePermission({ module: "providers", action: "update" }),
  (req, res) => controller.update(req, res),
);
router.delete(
  "/:id",
  requirePermission({ module: "providers", action: "delete" }),
  (req, res) => controller.delete(req, res),
);

export default router;
