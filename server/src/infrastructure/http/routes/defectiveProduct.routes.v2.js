import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { DefectiveProductController } from "../controllers/DefectiveProductController.js";

const router = Router();
const controller = new DefectiveProductController();

router.use(protect, businessContext, requireFeature("defectiveProducts"));

router.post("/admin", requirePermission("createDefectiveProduct"), (req, res) =>
  controller.reportAdmin(req, res),
);
router.post(
  "/distributor",
  requirePermission("createDefectiveProduct"),
  (req, res) => controller.reportDistributor(req, res),
);
router.get("/", requirePermission("readDefectiveProduct"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readDefectiveProduct"), (req, res) =>
  controller.getById(req, res),
);
router.put(
  "/:id/confirm",
  requirePermission("updateDefectiveProduct"),
  (req, res) => controller.confirm(req, res),
);
router.put(
  "/:id/reject",
  requirePermission("updateDefectiveProduct"),
  (req, res) => controller.reject(req, res),
);

export default router;
