import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  checkPlanLimits,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { EmployeeController } from "../controllers/EmployeeController.js";

const router = Router();
const controller = new EmployeeController();

router.use(protect, businessContext, requireFeature("employees"));

// IMPORTANTE: Rutas /me/* deben estar ANTES de /:id para evitar que "me" se tome como un ID
router.get("/me/products", (req, res) => controller.getProducts(req, res));

router.post(
  "/",
  requirePermission({ module: "employees", action: "create" }),
  checkPlanLimits("employees"),
  (req, res) => controller.create(req, res),
);
router.get(
  "/",
  requirePermission({ module: "employees", action: "read" }),
  (req, res) => controller.getAll(req, res),
);
router.get(
  "/:id",
  requirePermission({ module: "employees", action: "read" }),
  (req, res) => controller.getById(req, res),
);
router.put(
  "/:id",
  requirePermission({ module: "employees", action: "update" }),
  (req, res) => controller.update(req, res),
);
router.put(
  "/:id/toggle-active",
  requirePermission({ module: "employees", action: "update" }),
  (req, res) => controller.toggleActive(req, res),
);
router.delete(
  "/:id",
  requirePermission({ module: "employees", action: "delete" }),
  (req, res) => controller.delete(req, res),
);
router.put(
  "/:id/assign-products",
  requirePermission({ module: "employees", action: "update" }),
  (req, res) => controller.assignProducts(req, res),
);
router.get(
  "/:id/products",
  requirePermission({ module: "employees", action: "read" }),
  (req, res) => controller.getProducts(req, res),
);

export default router;
