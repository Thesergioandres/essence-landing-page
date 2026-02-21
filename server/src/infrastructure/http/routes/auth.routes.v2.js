import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireRole,
} from "../../../../middleware/business.middleware.js";
import {
  getProfile,
  impersonateDistributor,
  login,
  register,
  revertImpersonation,
} from "../controllers/AuthController.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/profile", protect, getProfile);
router.post("/impersonate/revert", protect, revertImpersonation);
router.post(
  "/impersonate/:distributorId",
  protect,
  businessContext,
  requireRole(["admin", "super_admin"]),
  impersonateDistributor,
);

export default router;
