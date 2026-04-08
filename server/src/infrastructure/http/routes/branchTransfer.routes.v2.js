import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { BranchTransferController } from "../controllers/BranchTransferController.js";

const router = Router();
const controller = new BranchTransferController();

router.use(protect, businessContext, requireFeature("branches"));

router.post(
  "/",
  requirePermission({ module: "transfers", action: "create" }),
  (req, res) => controller.create(req, res),
);
router.get(
  "/",
  requirePermission({ module: "transfers", action: "read" }),
  (req, res) => controller.getAll(req, res),
);
router.get(
  "/:id",
  requirePermission({ module: "transfers", action: "read" }),
  (req, res) => controller.getById(req, res),
);

export default router;
