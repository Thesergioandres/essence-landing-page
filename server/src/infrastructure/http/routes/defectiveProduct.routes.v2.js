import { Router } from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { DefectiveProductController } from "../controllers/DefectiveProductController.js";

const router = Router();
const controller = new DefectiveProductController();

router.use(protect, businessContext, requireFeature("defectiveProducts"));

router.post(
  "/admin",
  requirePermission({ module: "defectiveProducts", action: "create" }),
  (req, res) => controller.reportAdmin(req, res),
);
router.post(
  "/branch",
  requirePermission({ module: "defectiveProducts", action: "create" }),
  (req, res) => controller.reportFromBranch(req, res),
);
router.post(
  "/",
  requirePermission({ module: "defectiveProducts", action: "create" }),
  (req, res) => controller.reportEmployee(req, res),
);
router.post(
  "/employee",
  requirePermission({ module: "defectiveProducts", action: "create" }),
  (req, res) => controller.reportEmployee(req, res),
);
router.get(
  "/employee/me",
  requirePermission({ module: "defectiveProducts", action: "read" }),
  (req, res) => controller.getEmployeeReports(req, res),
);
router.get(
  "/employee/:employeeId",
  requirePermission({ module: "defectiveProducts", action: "read" }),
  (req, res) => controller.getEmployeeReports(req, res),
);
router.get(
  "/",
  requirePermission({ module: "defectiveProducts", action: "read" }),
  (req, res) => controller.getAll(req, res),
);
router.get(
  "/warranty/sale/:saleId",
  requirePermission({ module: "defectiveProducts", action: "read" }),
  (req, res) => controller.getSaleLookup(req, res),
);
router.post(
  "/warranty",
  requirePermission({ module: "defectiveProducts", action: "create" }),
  (req, res) => controller.createCustomerWarranty(req, res),
);
router.get(
  "/stats",
  requirePermission({ module: "defectiveProducts", action: "read" }),
  (req, res) => controller.getStats(req, res),
);
router.get(
  "/:id",
  requirePermission({ module: "defectiveProducts", action: "read" }),
  (req, res) => controller.getById(req, res),
);
router.put(
  "/:id/confirm",
  requirePermission({ module: "defectiveProducts", action: "update" }),
  (req, res) => controller.confirm(req, res),
);
router.put(
  "/:id/reject",
  requirePermission({ module: "defectiveProducts", action: "update" }),
  (req, res) => controller.reject(req, res),
);
router.put(
  "/:id/resolve-warranty",
  requirePermission({ module: "defectiveProducts", action: "update" }),
  (req, res) => controller.resolveCustomerWarranty(req, res),
);

router.put(
  "/:id/approve-warranty",
  requirePermission({ module: "defectiveProducts", action: "update" }),
  (req, res) => controller.approveWarranty(req, res),
);
router.put(
  "/:id/reject-warranty",
  requirePermission({ module: "defectiveProducts", action: "update" }),
  (req, res) => controller.rejectWarranty(req, res),
);

router.delete(
  "/:id",
  requirePermission({ module: "defectiveProducts", action: "update" }),
  (req, res) => controller.cancel(req, res),
);

export default router;
