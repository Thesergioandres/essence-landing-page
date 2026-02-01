import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { DistributorController } from "../controllers/DistributorController.js";

const router = Router();
const controller = new DistributorController();

router.use(protect, businessContext, requireFeature("distributors"));

router.post("/", requirePermission("createDistributor"), (req, res) =>
  controller.create(req, res),
);
router.get("/", requirePermission("readDistributor"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readDistributor"), (req, res) =>
  controller.getById(req, res),
);
router.put("/:id", requirePermission("updateDistributor"), (req, res) =>
  controller.update(req, res),
);
router.delete("/:id", requirePermission("deleteDistributor"), (req, res) =>
  controller.delete(req, res),
);
router.put(
  "/:id/assign-products",
  requirePermission("updateDistributor"),
  (req, res) => controller.assignProducts(req, res),
);

export default router;
