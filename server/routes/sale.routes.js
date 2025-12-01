import express from "express";
import {
  confirmPayment,
  deleteSale,
  getAllSales,
  getDistributorSales,
  getSalesByDistributor,
  getSalesByProduct,
  registerSale,
  registerAdminSale,
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
router.put("/:id/confirm-payment", protect, admin, confirmPayment);

// Registrar venta como admin (stock general)
router.post("/admin", protect, admin, registerAdminSale);

// Eliminar venta (admin)
router.delete("/:id", protect, admin, deleteSale);

export default router;
