import express from "express";
import {
  assignStockToDistributor,
  getAllDistributorsStock,
  getDistributorStock,
  getStockAlerts,
  withdrawStockFromDistributor,
  transferStockBetweenDistributors,
  getTransferHistory,
} from "../controllers/stock.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas de administrador
router.post("/assign", protect, admin, assignStockToDistributor);
router.post("/withdraw", protect, admin, withdrawStockFromDistributor);
router.get("/all", protect, admin, getAllDistributorsStock);
router.get("/alerts", protect, admin, getStockAlerts);
router.get("/transfers", protect, admin, getTransferHistory); // Historial de transferencias

// Rutas para distribuidor
router.get("/distributor/:distributorId", protect, getDistributorStock);
router.post("/transfer", protect, transferStockBetweenDistributors);

export default router;
