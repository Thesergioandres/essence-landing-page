/**
 * DeliveryMethod Routes V2 - Hexagonal Architecture
 * Routes for delivery method operations
 */

import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import DeliveryMethodController from "../controllers/DeliveryMethodController.js";

const router = express.Router();

// All routes require authentication, business context and sales feature
router.use(protect, businessContext, requireFeature("sales"));

/**
 * @route   GET /api/v2/delivery-methods
 * @desc    Get all delivery methods
 * @access  Private
 */
router.get(
  "/",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => DeliveryMethodController.getAll(req, res),
);

/**
 * @route   GET /api/v2/delivery-methods/:id
 * @desc    Get delivery method by ID
 * @access  Private
 */
router.get(
  "/:id",
  requirePermission({ module: "sales", action: "read" }),
  (req, res) => DeliveryMethodController.getById(req, res),
);

/**
 * @route   POST /api/v2/delivery-methods
 * @desc    Create new delivery method
 * @access  Private/Admin
 */
router.post(
  "/",
  requirePermission({ module: "sales", action: "create" }),
  (req, res) => DeliveryMethodController.create(req, res),
);

/**
 * @route   POST /api/v2/delivery-methods/initialize
 * @desc    Initialize default delivery methods
 * @access  Private/Admin
 */
router.post(
  "/initialize",
  requirePermission({ module: "sales", action: "create" }),
  (req, res) => DeliveryMethodController.initialize(req, res),
);

/**
 * @route   PUT /api/v2/delivery-methods/reorder
 * @desc    Reorder delivery methods
 * @access  Private/Admin
 */
router.put(
  "/reorder",
  requirePermission({ module: "sales", action: "update" }),
  (req, res) => DeliveryMethodController.reorder(req, res),
);

/**
 * @route   PUT /api/v2/delivery-methods/:id
 * @desc    Update delivery method
 * @access  Private/Admin
 */
router.put(
  "/:id",
  requirePermission({ module: "sales", action: "update" }),
  (req, res) => DeliveryMethodController.update(req, res),
);

/**
 * @route   DELETE /api/v2/delivery-methods/:id
 * @desc    Delete delivery method
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  requirePermission({ module: "sales", action: "delete" }),
  (req, res) => DeliveryMethodController.delete(req, res),
);

export default router;
