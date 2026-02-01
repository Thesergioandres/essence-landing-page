import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import StockController from "../controllers/StockController.js";

const router = express.Router();
router.use(protect, businessContext, requireFeature("inventory"));

router.post(
  "/assign",
  requirePermission({ module: "inventory", action: "create" }),
  StockController.assignToDistributor.bind(StockController),
);
router.post(
  "/withdraw",
  requirePermission({ module: "inventory", action: "update" }),
  StockController.withdrawFromDistributor.bind(StockController),
);
router.get(
  "/distributor/:distributorId",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getDistributorStock.bind(StockController),
);
router.get(
  "/branch/:branchId?",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getBranchStock.bind(StockController),
);
router.get(
  "/alerts",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getAlerts.bind(StockController),
);

export default router;
