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

const allowDistributor = (module, action) => (req, res, next) => {
  if (req.user?.role === "distribuidor") return next();
  return requirePermission({ module, action })(req, res, next);
};

router.post("/", allowDistributor("clients", "create"), (req, res) =>
  controller.create(req, res),
);
router.get("/", allowDistributor("clients", "read"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", allowDistributor("clients", "read"), (req, res) =>
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
