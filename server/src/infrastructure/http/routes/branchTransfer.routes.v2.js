import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import { requireFeature } from "../../../../middleware/business.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { BranchTransferController } from "../controllers/BranchTransferController.js";

const router = Router();
const controller = new BranchTransferController();

router.use(protect, businessContext, requireFeature("branches"));

router.post("/", requirePermission("createBranchTransfer"), (req, res) =>
  controller.create(req, res),
);
router.get("/", requirePermission("readBranchTransfer"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readBranchTransfer"), (req, res) =>
  controller.getById(req, res),
);

export default router;
