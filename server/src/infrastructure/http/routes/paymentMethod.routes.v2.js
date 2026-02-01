/**
 * PaymentMethod Routes V2 - Hexagonal Architecture
 * Routes for payment method operations
 */

import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import PaymentMethodController from "../controllers/PaymentMethodController.js";

const router = express.Router();

// All routes require authentication, business context and sales feature
router.use(protect, businessContext, requireFeature("sales"));

/**
 * @route   GET /api/v2/payment-methods
 * @desc    Get all payment methods
 * @access  Private
 */
router.get(
  "/",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => PaymentMethodController.getAll(req, res),
);

/**
 * @route   GET /api/v2/payment-methods/:id
 * @desc    Get payment method by ID
 * @access  Private
 */
router.get(
  "/:id",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => PaymentMethodController.getById(req, res),
);

/**
 * @route   POST /api/v2/payment-methods
 * @desc    Create new payment method
 * @access  Private/Admin
 */
router.post(
  "/",
  requirePermission({ module: "sales", action: "create" }),
  (req, res) => PaymentMethodController.create(req, res),
);

/**
 * @route   POST /api/v2/payment-methods/initialize
 * @desc    Initialize default payment methods
 * @access  Private/Admin
 */
router.post(
  "/initialize",
  requirePermission({ module: "sales", action: "create" }),
  (req, res) => PaymentMethodController.initialize(req, res),
);

/**
 * @route   PUT /api/v2/payment-methods/reorder
 * @desc    Reorder payment methods
 * @access  Private/Admin
 */
router.put(
  "/reorder",
  requirePermission({ module: "sales", action: "update" }),
  (req, res) => PaymentMethodController.reorder(req, res),
);

/**
 * @route   PUT /api/v2/payment-methods/:id
 * @desc    Update payment method
 * @access  Private/Admin
 */
router.put(
  "/:id",
  requirePermission({ module: "sales", action: "update" }),
  (req, res) => PaymentMethodController.update(req, res),
);

/**
 * @route   DELETE /api/v2/payment-methods/:id
 * @desc    Delete payment method
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  requirePermission({ module: "sales", action: "delete" }),
  (req, res) => PaymentMethodController.delete(req, res),
);

export default router;
