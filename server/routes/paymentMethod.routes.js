import express from "express";
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethodById,
  getPaymentMethods,
  initializeDefaultMethods,
  reorderPaymentMethods,
  updatePaymentMethod,
} from "../controllers/paymentMethod.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

// Todas las rutas requieren autenticación y contexto de negocio
router.use(protect, businessContext, requireFeature("sales"));

// Rutas públicas (lectura)
router.get(
  "/",
  requirePermission({ module: "sales", action: "read" }),
  getPaymentMethods
);

router.get(
  "/:id",
  requirePermission({ module: "sales", action: "read" }),
  getPaymentMethodById
);

// Rutas de administrador
router.post(
  "/",
  requirePermission({ module: "sales", action: "create" }),
  createPaymentMethod
);

router.post(
  "/initialize",
  requirePermission({ module: "sales", action: "create" }),
  initializeDefaultMethods
);

router.put(
  "/reorder",
  requirePermission({ module: "sales", action: "update" }),
  reorderPaymentMethods
);

router.put(
  "/:id",
  requirePermission({ module: "sales", action: "update" }),
  updatePaymentMethod
);

router.delete(
  "/:id",
  requirePermission({ module: "sales", action: "delete" }),
  deletePaymentMethod
);

export default router;
