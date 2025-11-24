import express from "express";
import {
  getAllSales,
  getDistributorSales,
  getSalesByDistributor,
  getSalesByProduct,
  registerSale,
} from "../controllers/sale.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas para distribuidores
router.post("/", protect, registerSale);
router.get("/distributor/:distributorId?", protect, getDistributorSales);

// Rutas de administrador
router.get("/", protect, admin, getAllSales);
router.get("/report/by-product", protect, admin, getSalesByProduct);
router.get("/report/by-distributor", protect, admin, getSalesByDistributor);

export default router;
