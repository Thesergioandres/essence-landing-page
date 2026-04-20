import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requireRole,
} from "../../../../middleware/business.middleware.js";
import EmployeeScheduleController from "../controllers/EmployeeScheduleController.js";

const router = express.Router();

router.use(protect, businessContext, requireFeature("employees"));

router.get(
  "/me",
  requireRole(["employee", "admin", "super_admin"]),
  (req, res) => EmployeeScheduleController.getMySchedule(req, res),
);

router.put(
  "/me",
  requireRole(["employee", "admin", "super_admin"]),
  (req, res) => EmployeeScheduleController.saveMySchedule(req, res),
);

router.get("/overview", requireRole(["admin", "super_admin"]), (req, res) =>
  EmployeeScheduleController.getBranchOverview(req, res),
);

router.get(
  "/employee/:employeeId",
  requireRole(["admin", "super_admin"]),
  (req, res) => EmployeeScheduleController.getEmployeeSchedule(req, res),
);

router.put(
  "/employee/:employeeId",
  requireRole(["admin", "super_admin"]),
  (req, res) => EmployeeScheduleController.saveEmployeeSchedule(req, res),
);

export default router;
