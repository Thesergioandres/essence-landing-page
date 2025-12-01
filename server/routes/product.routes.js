import express from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
  getDistributorPrice,
} from "../controllers/product.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas públicas
router.get("/", getProducts);
router.get("/:id", getProduct);

// Rutas protegidas
router.get("/:id/distributor-price/:distributorId", protect, getDistributorPrice);

// Rutas protegidas (solo admin)
router.post("/", protect, admin, createProduct);
router.put("/:id", protect, admin, updateProduct);
router.delete("/:id", protect, admin, deleteProduct);

export default router;
