import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireRole,
} from "../../../../middleware/business.middleware.js";
import {
  setupDemoSandbox,
  teardownDemoSandbox,
} from "../controllers/DemoController.js";

const router = express.Router();

router.post("/setup", setupDemoSandbox);
router.delete(
  "/teardown",
  protect,
  businessContext,
  requireRole(["admin", "super_admin", "god"]),
  teardownDemoSandbox,
);

export default router;
