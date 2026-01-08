import express from "express";
import {
  createInventoryEntry,
  deleteInventoryEntry,
  getInventorySummary,
  getProductHistory,
  listInventoryEntries,
  updateInventoryEntry,
} from "../controllers/inventory.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

router.use(protect, businessContext, requireFeature("inventory"));

router.post(
  "/entry",
  requirePermission({ module: "inventory", action: "create" }),
  createInventoryEntry
);

router.get(
  "/entries",
  requirePermission({ module: "inventory", action: "read" }),
  listInventoryEntries
);

router.put(
  "/entry/:id",
  requirePermission({ module: "inventory", action: "update" }),
  updateInventoryEntry
);

router.delete(
  "/entry/:id",
  requirePermission({ module: "inventory", action: "delete" }),
  deleteInventoryEntry
);

router.get(
  "/product/:productId/history",
  requirePermission({ module: "inventory", action: "read" }),
  getProductHistory
);

router.get(
  "/summary",
  requirePermission({ module: "inventory", action: "read" }),
  getInventorySummary
);

export default router;
