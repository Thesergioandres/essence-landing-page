import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import {
  createProduct,
  getProductById,
  updateStock,
} from "../controllers/ProductController.js";

const router = express.Router();

// Public/Protected Read (depending on policy, assuming protected for now)
router.get("/:id", protect, businessContext, getProductById);

// Create Product
router.post(
  "/",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "create" }),
  createProduct,
);

// Update Stock (Dedicated endpoint)
router.patch(
  "/:id/stock",
  protect,
  businessContext,
  requireFeature("inventory"),
  requirePermission({ module: "inventory", action: "update" }),
  updateStock,
);

export default router;
