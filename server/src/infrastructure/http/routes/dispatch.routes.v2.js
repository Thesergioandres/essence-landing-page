import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import DispatchController from "../controllers/DispatchController.js";

const router = Router();

router.use(protect, businessContext, requireFeature("transfers"));

router.post(
  "/requests",
  requirePermission({ module: "transfers", action: "create" }),
  (req, res) => DispatchController.createRequest(req, res),
);

router.get(
  "/requests",
  requirePermission({ module: "transfers", action: "read" }),
  (req, res) => DispatchController.listRequests(req, res),
);

router.get(
  "/requests/:id",
  requirePermission({ module: "transfers", action: "read" }),
  (req, res) => DispatchController.getById(req, res),
);

router.patch(
  "/requests/:id/dispatch",
  requirePermission({ module: "transfers", action: "update" }),
  (req, res) => DispatchController.markAsDispatched(req, res),
);

router.patch(
  "/requests/:id/receive",
  requirePermission({ module: "transfers", action: "create" }),
  (req, res) => DispatchController.confirmReception(req, res),
);

router.get(
  "/pending-count",
  requirePermission({ module: "transfers", action: "read" }),
  (req, res) => DispatchController.getPendingCount(req, res),
);

router.get(
  "/hot-sectors",
  requirePermission({ module: "transfers", action: "read" }),
  (req, res) => DispatchController.getHotSectors(req, res),
);

export default router;
