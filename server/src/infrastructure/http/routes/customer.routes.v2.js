import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { CustomerController } from "../controllers/CustomerController.js";

const router = Router();
const controller = new CustomerController();

router.use(protect, businessContext, requireFeature("crm"));

router.post("/", requirePermission("createCustomer"), (req, res) =>
  controller.create(req, res),
);
router.get("/", requirePermission("readCustomer"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readCustomer"), (req, res) =>
  controller.getById(req, res),
);
router.put("/:id", requirePermission("updateCustomer"), (req, res) =>
  controller.update(req, res),
);
router.delete("/:id", requirePermission("deleteCustomer"), (req, res) =>
  controller.delete(req, res),
);

export default router;
