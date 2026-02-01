/**
 * CustomerPoints Routes V2 - Hexagonal Architecture
 * Routes for customer points operations
 */

import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import CustomerPointsController from "../controllers/CustomerPointsController.js";

const router = express.Router();

// All routes require authentication and business context
router.use(protect, businessContext);

/**
 * @route   GET /api/v2/customers/:customerId/points
 * @desc    Get customer points balance
 * @access  Private
 */
router.get(
  "/customers/:customerId/points",
  requirePermission({ module: "clients", action: "read" }),
  (req, res) => CustomerPointsController.getBalance(req, res),
);

/**
 * @route   GET /api/v2/customers/:customerId/points/history
 * @desc    Get customer points history
 * @access  Private
 */
router.get(
  "/customers/:customerId/points/history",
  requirePermission({ module: "clients", action: "read" }),
  (req, res) => CustomerPointsController.getHistory(req, res),
);

/**
 * @route   POST /api/v2/customers/:customerId/points/adjust
 * @desc    Adjust customer points (add/subtract)
 * @access  Private/Admin
 */
router.post(
  "/customers/:customerId/points/adjust",
  requirePermission({ module: "clients", action: "update" }),
  (req, res) => CustomerPointsController.adjustPoints(req, res),
);

/**
 * @route   POST /api/v2/customers/:customerId/points/validate-redemption
 * @desc    Validate points redemption
 * @access  Private
 */
router.post(
  "/customers/:customerId/points/validate-redemption",
  requirePermission({ module: "clients", action: "read" }),
  (req, res) => CustomerPointsController.validateRedemption(req, res),
);

/**
 * @route   POST /api/v2/points/expire
 * @desc    Expire old points
 * @access  Private/Admin
 */
router.post(
  "/points/expire",
  requirePermission({ module: "clients", action: "delete" }),
  (req, res) => CustomerPointsController.expirePoints(req, res),
);

/**
 * @route   GET /api/v2/points/config
 * @desc    Get points configuration
 * @access  Private
 */
router.get("/points/config", (req, res) =>
  CustomerPointsController.getConfig(req, res),
);

export default router;
