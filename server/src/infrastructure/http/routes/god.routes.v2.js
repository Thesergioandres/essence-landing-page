/**
 * God Routes V2 - Hexagonal Architecture
 * Routes for super admin operations
 */

import express from "express";
import {
  cleanupInconsistentSubscriptions,
  runSubscriptionChecks,
} from "../../../../jobs/subscription.cron.js";
import { god, protect } from "../../../../middleware/auth.middleware.js";
import GodController from "../controllers/GodController.js";

const router = express.Router();

// All routes require god authentication
router.use(protect, god);

/**
 * @route   GET /api/v2/god/metrics
 * @desc    Get global system metrics
 * @access  Private/God
 */
router.get("/metrics", (req, res) => GodController.getMetrics(req, res));

/**
 * @route   GET /api/v2/god/subscriptions
 * @desc    Get subscriptions summary
 * @access  Private/God
 */
router.get("/subscriptions", (req, res) =>
  GodController.getSubscriptions(req, res),
);

/**
 * @route   GET /api/v2/god/users
 * @desc    List all users
 * @access  Private/God
 */
router.get("/users", (req, res) => GodController.listUsers(req, res));

/**
 * @route   GET /api/v2/god/users/email/:email
 * @desc    Find user by email
 * @access  Private/God
 */
router.get("/users/email/:email", (req, res) =>
  GodController.findUserByEmail(req, res),
);

/**
 * @route   POST /api/v2/god/users/:id/activate
 * @desc    Activate user
 * @access  Private/God
 */
router.post("/users/:id/activate", (req, res) =>
  GodController.activateUser(req, res),
);

/**
 * @route   POST /api/v2/god/users/:id/suspend
 * @desc    Suspend user
 * @access  Private/God
 */
router.post("/users/:id/suspend", (req, res) =>
  GodController.suspendUser(req, res),
);

/**
 * @route   DELETE /api/v2/god/users/:id
 * @desc    Delete user and all associated data
 * @access  Private/God
 */
router.delete("/users/:id", (req, res) => GodController.deleteUser(req, res));

/**
 * @route   POST /api/v2/god/users/:id/extend
 * @desc    Extend subscription
 * @access  Private/God
 */
router.post("/users/:id/extend", (req, res) =>
  GodController.extendSubscription(req, res),
);

/**
 * @route   POST /api/v2/god/users/:id/pause
 * @desc    Pause subscription
 * @access  Private/God
 */
router.post("/users/:id/pause", (req, res) =>
  GodController.pauseSubscription(req, res),
);

/**
 * @route   POST /api/v2/god/users/:id/resume
 * @desc    Resume subscription
 * @access  Private/God
 */
router.post("/users/:id/resume", (req, res) =>
  GodController.resumeSubscription(req, res),
);

/**
 * @route   POST /api/v2/god/cron/subscription-checks
 * @desc    Run subscription checks manually
 * @access  Private/God
 */
router.post("/cron/subscription-checks", async (req, res) => {
  try {
    const results = await runSubscriptionChecks();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error ejecutando verificación",
    });
  }
});

/**
 * @route   POST /api/v2/god/cron/cleanup-subscriptions
 * @desc    Cleanup inconsistent subscriptions
 * @access  Private/God
 */
router.post("/cron/cleanup-subscriptions", async (req, res) => {
  try {
    const results = await cleanupInconsistentSubscriptions();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error limpiando suscripciones",
    });
  }
});

/**
 * @route   POST /api/v2/god/sales/validate-integrity
 * @desc    Validate and cleanup orphan sales for a business
 * @access  Private/God
 */
router.post("/sales/validate-integrity", (req, res) =>
  GodController.validateSalesIntegrity(req, res),
);

export default router;
