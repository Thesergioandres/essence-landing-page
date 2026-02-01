import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import InventoryController from "../controllers/InventoryController.js";

const router = express.Router();
router.use(protect, businessContext, requireFeature("inventory"));

router.post(
  "/entry",
  requirePermission({ module: "inventory", action: "create" }),
  InventoryController.createEntry.bind(InventoryController),
);
router.get(
  "/entries",
  requirePermission({ module: "inventory", action: "read" }),
  InventoryController.listEntries.bind(InventoryController),
);

export default router;
