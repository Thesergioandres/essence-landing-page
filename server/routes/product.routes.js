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
import { cacheMiddleware } from "../middleware/cache.middleware.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

// Rutas públicas con caché
router.get("/", cacheMiddleware(600, 'products'), getProducts); // 10 minutos
router.get("/:id", cacheMiddleware(600, 'product'), getProduct); // 10 minutos

// Rutas protegidas
router.get("/:id/distributor-price/:distributorId", protect, getDistributorPrice);

// Rutas protegidas (solo admin) - con upload de imagen
router.post("/", protect, admin, upload.single('image'), createProduct);
router.put("/:id", protect, admin, upload.single('image'), updateProduct);
router.delete("/:id", protect, admin, deleteProduct);

export default router;
