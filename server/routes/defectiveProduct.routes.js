import express from "express";
import {
  confirmDefectiveProduct,
  getAllDefectiveReports,
  getDistributorDefectiveReports,
  rejectDefectiveProduct,
  reportDefectiveProduct,
} from "../controllers/defectiveProduct.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas para distribuidores
router.post("/", protect, reportDefectiveProduct);
router.get("/distributor/:distributorId?", protect, getDistributorDefectiveReports);

// Rutas de administrador
router.get("/", protect, admin, getAllDefectiveReports);
router.put("/:id/confirm", protect, admin, confirmDefectiveProduct);
router.put("/:id/reject", protect, admin, rejectDefectiveProduct);

export default router;
