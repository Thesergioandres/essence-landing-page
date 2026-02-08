import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import { confirmSalePayment } from "../controllers/ConfirmSaleController.js";
import {
  deleteSale,
  deleteSaleGroup,
} from "../controllers/DeleteSaleController.js";
import { listSales } from "../controllers/ListSalesController.js";
import {
  registerPromotionSale,
  registerSale,
  registerStandardSale,
} from "../controllers/RegisterSaleController.js";

const router = express.Router();
const branchFromReq = (req) =>
  req.body?.branch || req.body?.branchId || req.params?.branchId;

// GET /api/v2/sales/distributor/:distributorId - List sales for specific distributor
// GET /api/v2/sales/distributor - List sales for current user (if distributor)
// NOTE: These routes MUST be before /:saleId to avoid matching "distributor" as saleId
router.get(
  "/distributor/:distributorId?",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "read",
  }),
  listSales,
);

// GET /api/v2/sales - List sales with pagination
router.get(
  "/",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "read",
  }),
  listSales,
);

// POST /api/v2/sales (default: standard)
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

// POST /api/v2/sales/standard
router.post(
  "/standard",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "create",
    branchResolver: branchFromReq,
  }),
  registerStandardSale,
);

// POST /api/v2/sales/promotion
router.post(
  "/promotion",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "create",
    branchResolver: branchFromReq,
  }),
  registerPromotionSale,
);

// PUT /api/v2/sales/:saleId/confirm-payment - Confirm sale payment
router.put(
  "/:saleId/confirm-payment",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "update",
  }),
  confirmSalePayment,
);

// DELETE /api/v2/sales/group/:saleGroupId - Delete all sales in a group
// NOTE: This route MUST be before /:saleId to avoid matching "group" as saleId
router.delete(
  "/group/:saleGroupId",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "delete",
  }),
  deleteSaleGroup,
);

// DELETE /api/v2/sales/:saleId - Delete a single sale
router.delete(
  "/:saleId",
  protect,
  businessContext,
  requireFeature("sales"),
  requirePermission({
    module: "sales",
    action: "delete",
  }),
  deleteSale,
);

export default router;
