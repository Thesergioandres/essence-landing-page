import express from "express";
import {
  checkPromotionStock,
  createFromAI,
  createPromotion,
  deletePromotion,
  evaluatePromotionHandler,
  getCatalogPromotions,
  getPromotionById,
  getPromotionMetrics,
  listPromotions,
  togglePromotionStatus,
  updatePromotion,
} from "../controllers/promotion.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

router.use(protect, businessContext, requireFeature("promotions"));

// Rutas específicas primero (antes de /:id)
router.get(
  "/metrics",
  requirePermission({ module: "promotions", action: "read" }),
  getPromotionMetrics,
);

router.get(
  "/catalog",
  requirePermission({ module: "promotions", action: "read" }),
  getCatalogPromotions,
);

// AI-powered promotion creation
router.post(
  "/create-from-ai",
  requirePermission({ module: "promotions", action: "create" }),
  createFromAI,
);

router
  .route("/")
  .post(
    requirePermission({ module: "promotions", action: "create" }),
    createPromotion,
  )
  .get(
    requirePermission({ module: "promotions", action: "read" }),
    listPromotions,
  );

router
  .route("/:id")
  .get(
    requirePermission({ module: "promotions", action: "read" }),
    getPromotionById,
  )
  .put(
    requirePermission({ module: "promotions", action: "update" }),
    updatePromotion,
  )
  .delete(
    requirePermission({ module: "promotions", action: "delete" }),
    deletePromotion,
  );

router.post(
  "/:id/evaluate",
  requirePermission({ module: "promotions", action: "read" }),
  evaluatePromotionHandler,
);

router.get(
  "/:id/check-stock",
  requirePermission({ module: "promotions", action: "read" }),
  checkPromotionStock,
);

router.patch(
  "/:id/toggle-status",
  requirePermission({ module: "promotions", action: "update" }),
  togglePromotionStatus,
);

export default router;
