import express from "express";
import {
  assignStockToDistributor,
  getAllDistributorsStock,
  getBranchStock,
  getBranchStockAlerts,
  getDistributorStock,
  getMyAllowedBranches,
  getStockAlerts,
  getTransferHistory,
  transferStockBetweenDistributors,
  transferStockToBranch,
  withdrawStockFromDistributor,
} from "../controllers/stock.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";
import { cacheMiddleware } from "../middleware/cache.middleware.js";

const router = express.Router();

// Rutas de administrador
router.post(
  "/assign",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "create" }),
  assignStockToDistributor
);
router.post(
  "/withdraw",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "update" }),
  withdrawStockFromDistributor
);
router.get(
  "/all",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "read" }),
  cacheMiddleware(60, "stock:all"),
  getAllDistributorsStock
);
router.get(
  "/branch/:branchId?",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "read" }),
  getBranchStock
);
router.get(
  "/alerts",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "read" }),
  cacheMiddleware(30, "stock:alerts"),
  getStockAlerts
);
router.get(
  "/branch-alerts",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "read" }),
  cacheMiddleware(30, "stock:branch-alerts"),
  getBranchStockAlerts
);
router.get(
  "/transfers",
  protect,
  businessContext,
  requireFeature("inventory"),
  requireFeature("transfers"),
  requirePermission({ module: "transfers", action: "read" }),
  getTransferHistory
); // Historial de transferencias

// Rutas para distribuidor
router.get(
  "/my-allowed-branches",
  protect,
  businessContext,
  getMyAllowedBranches
);
router.get(
  "/distributor/:distributorId",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "read" }),
  getDistributorStock
);
router.post(
  "/transfer",
  protect,
  businessContext,
  requireFeature("inventory"),
  requireFeature("transfers"),
  requirePermission({ module: "transfers", action: "create" }),
  transferStockBetweenDistributors
);
router.post(
  "/transfer-to-branch",
  protect,
  businessContext,
  requireFeature("inventory"),
  transferStockToBranch
);

export default router;
