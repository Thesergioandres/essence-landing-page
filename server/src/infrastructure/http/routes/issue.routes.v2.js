import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { requirePermission } from "../../../../middleware/business.middleware.js";
import { IssueController } from "../controllers/IssueController.js";

const router = Router();
const controller = new IssueController();

router.use(protect);

router.post("/", (req, res) => controller.create(req, res));
router.get("/", requirePermission("readIssue"), (req, res) =>
  controller.getAll(req, res),
);
router.get("/:id", requirePermission("readIssue"), (req, res) =>
  controller.getById(req, res),
);
router.put("/:id/status", requirePermission("updateIssue"), (req, res) =>
  controller.updateStatus(req, res),
);

export default router;
