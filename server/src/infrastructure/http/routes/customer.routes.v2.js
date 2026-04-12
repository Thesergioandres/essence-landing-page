import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { CustomerController } from "../controllers/CustomerController.js";

const router = Router();
const controller = new CustomerController();

router.use(protect, businessContext, requireFeature("crm"));

const allowEmployee = (module, action) => (req, res, next) => {
  if (req.user?.role === "employee") return next();
  return requirePermission({ module, action })(req, res, next);
};

router.post("/", allowEmployee("clients", "create"), (req, res) =>
  controller.create(req, res),
);
router.get("/", allowEmployee("clients", "read"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", allowEmployee("clients", "read"), (req, res) =>
  controller.getById(req, res),
);
router.put(
  "/:id",
  requirePermission({ module: "clients", action: "update" }),
  (req, res) => controller.update(req, res),
);
router.delete(
  "/:id",
  requirePermission({ module: "clients", action: "delete" }),
  (req, res) => controller.delete(req, res),
);

export default router;
