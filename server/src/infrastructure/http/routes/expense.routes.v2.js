import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import ExpenseController from "../controllers/ExpenseController.js";

const router = express.Router();
router.use(protect, businessContext, requireFeature("expenses"));

router.post(
  "/",
  requirePermission({ module: "expenses", action: "create" }),
  ExpenseController.create.bind(ExpenseController),
);
router.get(
  "/",
  requirePermission({ module: "expenses", action: "read" }),
  ExpenseController.getAll.bind(ExpenseController),
);
router.put(
  "/:id",
  requirePermission({ module: "expenses", action: "update" }),
  ExpenseController.update.bind(ExpenseController),
);
router.delete(
  "/:id",
  requirePermission({ module: "expenses", action: "delete" }),
  ExpenseController.delete.bind(ExpenseController),
);

export default router;
