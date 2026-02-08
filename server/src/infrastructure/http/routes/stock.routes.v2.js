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
router.post(
  "/transfer",
  requirePermission({ module: "inventory", action: "update" }),
  StockController.transferBetweenDistributors.bind(StockController),
);
router.post(
  "/transfer-to-branch",
  requirePermission({ module: "inventory", action: "update" }),
  StockController.transferToBranch.bind(StockController),
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
  "/my-allowed-branches",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getMyAllowedBranches.bind(StockController),
);
router.get(
  "/alerts",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getAlerts.bind(StockController),
);
router.get(
  "/global",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getGlobalStock.bind(StockController),
);
router.get(
  "/transfers",
  requirePermission({ module: "inventory", action: "read" }),
  StockController.getTransferHistory.bind(StockController),
);
router.post(
  "/reconcile",
  requirePermission({ module: "inventory", action: "update" }),
  StockController.reconcileStock.bind(StockController),
);
router.post(
  "/sync",
  requirePermission({ module: "inventory", action: "update" }),
  StockController.syncProductStock.bind(StockController),
);

export default router;
