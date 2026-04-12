import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireRole,
} from "../../../../middleware/business.middleware.js";
import {
  getProfile,
  impersonateEmployee,
  login,
  logout,
  refreshAccessToken,
  register,
  revertImpersonation,
  selectPlan,
} from "../controllers/AuthController.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.patch("/select-plan", protect, selectPlan);
router.get("/profile", protect, getProfile);
router.post("/impersonate/revert", protect, revertImpersonation);
router.post(
  "/impersonate/:employeeId",
  protect,
  businessContext,
  requireRole(["admin", "super_admin"]),
  impersonateEmployee,
);

export default router;
