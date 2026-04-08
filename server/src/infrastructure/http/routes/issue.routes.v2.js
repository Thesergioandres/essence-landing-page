import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { IssueController } from "../controllers/IssueController.js";

const router = Router();
const controller = new IssueController();

router.use(protect);

router.post("/", (req, res) => controller.create(req, res));
router.get(
  "/",
  requirePermission({ module: "config", action: "read" }),
  (req, res) => controller.getAll(req, res),
);
router.get(
  "/:id",
  requirePermission({ module: "config", action: "read" }),
  (req, res) => controller.getById(req, res),
);
router.put(
  "/:id/status",
  requirePermission({ module: "config", action: "update" }),
  (req, res) => controller.updateStatus(req, res),
);

export default router;
