import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { SpecialSaleController } from "../controllers/SpecialSaleController.js";

const router = Router();
const controller = new SpecialSaleController();

router.use(protect, businessContext, requireFeature("specialSales"));

router.post("/", requirePermission("createSpecialSale"), (req, res) =>
  controller.create(req, res),
);
router.get("/", requirePermission("readSpecialSale"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readSpecialSale"), (req, res) =>
  controller.getById(req, res),
);
router.put("/:id", requirePermission("updateSpecialSale"), (req, res) =>
  controller.update(req, res),
);
router.delete("/:id", requirePermission("deleteSpecialSale"), (req, res) =>
  controller.delete(req, res),
);

export default router;
