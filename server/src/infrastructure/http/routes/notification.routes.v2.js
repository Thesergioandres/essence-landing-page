import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { NotificationController } from "../controllers/NotificationController.js";

const router = Router();
const controller = new NotificationController();

router.use(protect, businessContext);

router.get("/", (req, res) => controller.getAll(req, res));
router.post(
  "/",
  requirePermission({ module: "config", action: "create" }),
  (req, res) => controller.create(req, res),
);
router.put("/:id/read", (req, res) => controller.markAsRead(req, res));
router.put("/read-all", (req, res) => controller.markAllAsRead(req, res));
router.delete(
  "/:id",
  requirePermission({ module: "config", action: "delete" }),
  (req, res) => controller.delete(req, res),
);

export default router;
