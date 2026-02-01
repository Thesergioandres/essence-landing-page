import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { registerSale } from "../controllers/RegisterSaleController.js";

const router = express.Router();
const branchFromReq = (req) =>
  req.body?.branch || req.body?.branchId || req.params?.branchId;

// POST /api/v2/sales
router.post(
  "/",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "create",
    branchResolver: branchFromReq,
  }),
  registerSale,
);

export default router;
