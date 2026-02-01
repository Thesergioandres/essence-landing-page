import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateStock,
} from "../controllers/ProductController.js";

const router = express.Router();

// Get all products for business
router.get("/", protect, businessContext, getAllProducts);

// Get single product by ID
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
