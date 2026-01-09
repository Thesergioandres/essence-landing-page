import express from "express";
import {
  approveWarranty,
  confirmDefectiveProduct,
  deleteDefectiveReport,
  getAllDefectiveReports,
  getDefectiveStats,
  getDistributorDefectiveReports,
  rejectDefectiveProduct,
  rejectWarranty,
  reportDefectiveProduct,
  reportDefectiveProductAdmin,
  reportDefectiveProductBranch,
} from "../controllers/defectiveProduct.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

router.use(protect, businessContext, requireFeature("inventory"));

// Estadísticas (debe ir antes de /:id)
router.get(
  "/stats",
  requirePermission({ module: "inventory", action: "read" }),
  getDefectiveStats
);

// Rutas para distribuidores
router.post("/", reportDefectiveProduct);
router.get("/distributor/:distributorId?", getDistributorDefectiveReports);

// Rutas de administrador
router.post(
  "/admin",
  requirePermission({ module: "inventory", action: "create" }),
  reportDefectiveProductAdmin
);
router.post(
  "/branch",
  requirePermission({ module: "inventory", action: "create" }),
  reportDefectiveProductBranch
);
router.get(
  "/",
  requirePermission({ module: "inventory", action: "read" }),
  getAllDefectiveReports
);
router.put(
  "/:id/confirm",
  requirePermission({ module: "inventory", action: "update" }),
  confirmDefectiveProduct
);
router.put(
  "/:id/reject",
  requirePermission({ module: "inventory", action: "update" }),
  rejectDefectiveProduct
);

// Rutas de garantía
router.put(
  "/:id/approve-warranty",
  requirePermission({ module: "inventory", action: "update" }),
  approveWarranty
);
router.put(
  "/:id/reject-warranty",
  requirePermission({ module: "inventory", action: "update" }),
  rejectWarranty
);

// Eliminar reporte
router.delete(
  "/:id",
  requirePermission({ module: "inventory", action: "delete" }),
  deleteDefectiveReport
);

export default router;
