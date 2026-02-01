import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { ProviderController } from "../controllers/ProviderController.js";

const router = Router();
const controller = new ProviderController();

router.use(protect, businessContext, requireFeature("inventory"));

router.post("/", requirePermission("createProvider"), (req, res) =>
  controller.create(req, res),
);
router.get("/", requirePermission("readProvider"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readProvider"), (req, res) =>
  controller.getById(req, res),
);
router.put("/:id", requirePermission("updateProvider"), (req, res) =>
  controller.update(req, res),
);
router.delete("/:id", requirePermission("deleteProvider"), (req, res) =>
  controller.delete(req, res),
);

export default router;
