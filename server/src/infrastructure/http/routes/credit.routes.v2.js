import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import CreditController from "../controllers/CreditController.js";

const router = express.Router();
router.use(protect, businessContext, requireFeature("credits"));

router.post(
  "/",
  requirePermission({ module: "credits", action: "create" }),
  CreditController.create.bind(CreditController),
);
router.get(
  "/",
  requirePermission({ module: "credits", action: "read" }),
  CreditController.getAll.bind(CreditController),
);
router.get(
  "/metrics",
  requirePermission({ module: "credits", action: "read" }),
  CreditController.getMetrics.bind(CreditController),
);
router.get(
  "/:id",
  requirePermission({ module: "credits", action: "read" }),
  CreditController.getById.bind(CreditController),
);
router.post(
  "/:id/payments",
  requirePermission({ module: "credits", action: "update" }),
  CreditController.registerPayment.bind(CreditController),
);

export default router;
