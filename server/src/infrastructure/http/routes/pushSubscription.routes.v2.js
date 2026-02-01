/**
 * PushSubscription Routes V2 - Hexagonal Architecture
 * Routes for push notification subscription operations
 */

import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import { businessContext } from "../../../../middleware/business.middleware.js";
import PushSubscriptionController from "../controllers/PushSubscriptionController.js";

const router = express.Router();

/**
 * @route   GET /api/v2/push/vapid-key
 * @desc    Get VAPID public key (public route)
 * @access  Public
 */
router.get("/vapid-key", (req, res) =>
  PushSubscriptionController.getVapidKey(req, res),
);

// All routes below require authentication
router.use(protect, businessContext);

/**
 * @route   POST /api/v2/push/subscribe
 * @desc    Register push subscription
 * @access  Private
 */
router.post("/subscribe", (req, res) =>
  PushSubscriptionController.subscribe(req, res),
);

/**
 * @route   POST /api/v2/push/unsubscribe
 * @desc    Unsubscribe push notification
 * @access  Private
 */
router.post("/unsubscribe", (req, res) =>
  PushSubscriptionController.unsubscribe(req, res),
);

/**
 * @route   GET /api/v2/push/subscriptions
 * @desc    Get user subscriptions
 * @access  Private
 */
router.get("/subscriptions", (req, res) =>
  PushSubscriptionController.getSubscriptions(req, res),
);

/**
 * @route   PUT /api/v2/push/subscriptions/:id/preferences
 * @desc    Update subscription preferences
 * @access  Private
 */
router.put("/subscriptions/:id/preferences", (req, res) =>
  PushSubscriptionController.updatePreferences(req, res),
);

/**
 * @route   DELETE /api/v2/push/subscriptions/:id
 * @desc    Delete subscription
 * @access  Private
 */
router.delete("/subscriptions/:id", (req, res) =>
  PushSubscriptionController.delete(req, res),
);

export default router;
