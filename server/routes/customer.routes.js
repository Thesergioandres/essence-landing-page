import express from "express";
import {
  adjustPoints,
  createCustomer,
  customerRFM,
  customerStats,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "../controllers/customer.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

router.use(protect, businessContext, requireFeature("customers"));

router
  .route("/")
  .post(
    requirePermission({ module: "customers", action: "create" }),
    createCustomer
  )
  .get(
    requirePermission({ module: "customers", action: "read" }),
    listCustomers
  );

router.get(
  "/stats",
  requirePermission({ module: "customers", action: "read" }),
  customerStats
);

router.get(
  "/rfm",
  requirePermission({ module: "customers", action: "read" }),
  customerRFM
);

router
  .route("/:id")
  .get(
    requirePermission({ module: "customers", action: "read" }),
    getCustomerById
  )
  .put(
    requirePermission({ module: "customers", action: "update" }),
    updateCustomer
  )
  .delete(
    requirePermission({ module: "customers", action: "delete" }),
    deleteCustomer
  );

router.post(
  "/:id/points",
  requirePermission({ module: "customers", action: "update" }),
  adjustPoints
);

export default router;
