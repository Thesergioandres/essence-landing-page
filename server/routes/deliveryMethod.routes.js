import express from "express";
import {
  createDeliveryMethod,
  deleteDeliveryMethod,
  getDeliveryMethodById,
  getDeliveryMethods,
  initializeDefaultMethods,
  reorderDeliveryMethods,
  updateDeliveryMethod,
} from "../controllers/deliveryMethod.controller.js";
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
  getDeliveryMethods
);

router.get(
  "/:id",
  requirePermission({ module: "sales", action: "read" }),
  getDeliveryMethodById
);

// Rutas de administrador
router.post(
  "/",
  requirePermission({ module: "sales", action: "create" }),
  createDeliveryMethod
);

router.post(
  "/initialize",
  requirePermission({ module: "sales", action: "create" }),
  initializeDefaultMethods
);

router.put(
  "/reorder",
  requirePermission({ module: "sales", action: "update" }),
  reorderDeliveryMethods
);

router.put(
  "/:id",
  requirePermission({ module: "sales", action: "update" }),
  updateDeliveryMethod
);

router.delete(
  "/:id",
  requirePermission({ module: "sales", action: "delete" }),
  deleteDeliveryMethod
);

export default router;
