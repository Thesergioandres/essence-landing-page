import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { SpecialSaleController } from "../controllers/SpecialSaleController.js";

const router = Router();
const controller = new SpecialSaleController();

router.use(protect, businessContext, requireFeature("specialSales"));

// Stats routes - MUST be before /:id to avoid matching "stats" as an ID
router.get(
  "/stats/overview",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => controller.getStatsOverview(req, res),
);
router.get(
  "/stats/distribution",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => controller.getStatsDistribution(req, res),
);
router.get(
  "/stats/top-products",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => controller.getStatsTopProducts(req, res),
);

router.post(
  "/",
  requirePermission({ module: "sales", action: "create" }),
  (req, res) => controller.create(req, res),
);
router.get(
  "/",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => controller.getAll(req, res),
);
router.get(
  "/:id",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => controller.getById(req, res),
);
router.put(
  "/:id",
  requirePermission({ module: "sales", action: "update" }),
  (req, res) => controller.update(req, res),
);
router.delete(
  "/:id",
  requirePermission({ module: "sales", action: "delete" }),
  (req, res) => controller.delete(req, res),
);

export default router;
