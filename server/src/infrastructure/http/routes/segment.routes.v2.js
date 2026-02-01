/**
 * Segment Routes V2 - Hexagonal Architecture
 * Routes for customer segment operations
 */

import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import SegmentController from "../controllers/SegmentController.js";

const router = express.Router();

// All routes require authentication, business context and clients feature
router.use(protect, businessContext, requireFeature("clients"));

/**
 * @route   GET /api/v2/segments
 * @desc    Get all segments
 * @access  Private
 */
router.get(
  "/",
  requirePermission({ module: "clients", action: "read" }),
  (req, res) => SegmentController.getAll(req, res),
);

/**
 * @route   POST /api/v2/segments
 * @desc    Create new segment
 * @access  Private/Admin
 */
router.post(
  "/",
  requirePermission({ module: "clients", action: "create" }),
  (req, res) => SegmentController.create(req, res),
);

/**
 * @route   GET /api/v2/segments/:id
 * @desc    Get segment by ID
 * @access  Private
 */
router.get(
  "/:id",
  requirePermission({ module: "clients", action: "read" }),
  (req, res) => SegmentController.getById(req, res),
);

/**
 * @route   PUT /api/v2/segments/:id
 * @desc    Update segment
 * @access  Private/Admin
 */
router.put(
  "/:id",
  requirePermission({ module: "clients", action: "update" }),
  (req, res) => SegmentController.update(req, res),
);

/**
 * @route   DELETE /api/v2/segments/:id
 * @desc    Delete segment
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  requirePermission({ module: "clients", action: "delete" }),
  (req, res) => SegmentController.delete(req, res),
);

export default router;
