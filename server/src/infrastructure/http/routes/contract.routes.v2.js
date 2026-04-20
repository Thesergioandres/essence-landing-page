import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requireRole,
} from "../../../../middleware/business.middleware.js";
import ContractController from "../controllers/ContractController.js";

const router = express.Router();

router.use(protect, businessContext, requireFeature("employees"));

router.get("/", requireRole(["employee", "admin", "super_admin"]), (req, res) =>
  ContractController.list(req, res),
);

router.get(
  "/:id",
  requireRole(["employee", "admin", "super_admin"]),
  (req, res) => ContractController.getById(req, res),
);

router.post(
  "/",
  requireRole(["employee", "admin", "super_admin"]),
  (req, res) => ContractController.create(req, res),
);

router.put("/:id", requireRole(["admin", "super_admin"]), (req, res) =>
  ContractController.update(req, res),
);

router.delete("/:id", requireRole(["admin", "super_admin"]), (req, res) =>
  ContractController.delete(req, res),
);

export default router;
