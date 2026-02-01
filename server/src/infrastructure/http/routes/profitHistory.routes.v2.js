/**
 * ProfitHistory Routes V2 - Hexagonal Architecture
 * Routes for profit history operations
 */

import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import ProfitHistoryController from "../controllers/ProfitHistoryController.js";

const router = express.Router();

// All routes require authentication, business context and reports feature
router.use(protect, businessContext, requireFeature("reports"));

/**
 * @route   GET /api/v2/profit-history/user/:userId
 * @desc    Get user profit history
 * @access  Private
 */
router.get(
  "/user/:userId",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => ProfitHistoryController.getUserHistory(req, res),
);

/**
 * @route   GET /api/v2/profit-history/balance/:userId
 * @desc    Get user balance
 * @access  Private
 */
router.get(
  "/balance/:userId",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => ProfitHistoryController.getUserBalance(req, res),
);

/**
 * @route   GET /api/v2/profit-history/summary
 * @desc    Get profit summary
 * @access  Private/Admin
 */
router.get(
  "/summary",
  requirePermission({ module: "analytics", action: "read" }),
  (req, res) => ProfitHistoryController.getSummary(req, res),
);

/**
 * @route   POST /api/v2/profit-history
 * @desc    Create profit entry
 * @access  Private/Admin
 */
router.post(
  "/",
  requirePermission({ module: "analytics", action: "create" }),
  (req, res) => ProfitHistoryController.create(req, res),
);

export default router;
