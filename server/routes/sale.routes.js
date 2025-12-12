import express from "express";
import {
  confirmPayment,
  deleteSale,
  fixAdminSales,
  getAllSales,
  getDistributorSales,
  getSalesByDistributor,
  getSalesByProduct,
  registerSale,
  registerAdminSale,
} from "../controllers/sale.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// ⚠️ IMPORTANTE: Las rutas específicas deben ir ANTES de las rutas con parámetros
// POST /admin debe ir ANTES de GET / para evitar que "admin" sea interpretado como un ID

// Registrar venta como admin (stock general) - DEBE IR PRIMERO
router.post("/admin", protect, admin, registerAdminSale);

// Fix temporal: actualizar ventas admin pendientes a confirmadas
router.post("/fix-admin-sales", protect, admin, fixAdminSales);

// Rutas para distribuidores
router.post("/", protect, registerSale);
router.get("/distributor/:distributorId?", protect, getDistributorSales);

// Rutas de administrador
router.get("/", protect, admin, getAllSales);
router.get("/report/by-product", protect, admin, getSalesByProduct);
router.get("/report/by-distributor", protect, admin, getSalesByDistributor);
router.put("/:id/confirm-payment", protect, admin, confirmPayment);

// Eliminar venta (admin)
router.delete("/:id", protect, admin, deleteSale);

export default router;
