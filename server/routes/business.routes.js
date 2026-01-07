import express from "express";
import {
  addMember,
  createBusiness,
  deleteBusiness,
  getBusinessDetail,
  getMyMemberships,
  listBusinesses,
  listMembers,
  removeMember,
  updateBusiness,
  updateBusinessFeatures,
  updateMember,
} from "../controllers/business.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireRole,
} from "../middleware/business.middleware.js";
import {
  protectDangerousOperation,
  requireConfirmation,
} from "../middleware/dangerousOperation.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/me/memberships", getMyMemberships);

// Permitir que cualquier usuario autenticado cree su primer negocio
router.post("/", createBusiness);
router.get(
  "/",
  requireRole(["super_admin"], { scope: "system" }),
  listBusinesses
);

router.use(
  "/:businessId",
  (req, _res, next) => {
    req.headers["x-business-id"] = req.params.businessId;
    next();
  },
  businessContext
);

router.get(
  "/:businessId",
  requireRole(["super_admin", "admin"]),
  getBusinessDetail
);

router.delete(
  "/:businessId",
  requireRole(["super_admin"], { scope: "system" }),
  protectDangerousOperation("delete_business"),
  requireConfirmation,
  deleteBusiness
);

router.patch(
  "/:businessId",
  requireRole(["super_admin", "admin"]),
  updateBusiness
);

router.get(
  "/:businessId/members",
  requireRole(["super_admin", "admin"]),
  listMembers
);
router.post(
  "/:businessId/members",
  requireRole(["super_admin", "admin"]),
  addMember
);
router.patch(
  "/:businessId/members/:membershipId",
  requireRole(["super_admin", "admin"]),
  updateMember
);
router.delete(
  "/:businessId/members/:membershipId",
  requireRole(["super_admin", "admin"]),
  removeMember
);

router.patch(
  "/:businessId/features",
  requireRole(["super_admin", "admin"]),
  updateBusinessFeatures
);

export default router;
