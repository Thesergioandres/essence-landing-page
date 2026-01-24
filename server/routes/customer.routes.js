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
  requirePermission,
} from "../middleware/business.middleware.js";

const router = express.Router();

// Todos los usuarios autenticados pueden acceder a clientes (distribuidores incluidos)
router.use(protect, businessContext);

router.route("/").post(createCustomer).get(listCustomers);

router.get("/stats", customerStats);

router.get("/rfm", customerRFM);

router
  .route("/:id")
  .get(getCustomerById)
  .put(updateCustomer)
  .delete(
    requirePermission({ module: "customers", action: "delete" }),
    deleteCustomer,
  );

router.post("/:id/points", adjustPoints);

export default router;
