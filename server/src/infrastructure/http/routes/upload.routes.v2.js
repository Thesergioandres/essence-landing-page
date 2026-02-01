/**
 * Upload Routes V2 - Hexagonal Architecture
 * Routes for file upload operations
 */

import express from "express";
import upload from "../../../../config/multer.js";
import { protect } from "../../../../middleware/auth.middleware.js";
import UploadController from "../controllers/UploadController.js";

const router = express.Router();

/**
 * @route   POST /api/v2/upload
 * @desc    Upload image (Base64)
 * @access  Private
 */
router.post("/", protect, upload.single("image"), (req, res) =>
  UploadController.uploadImage(req, res),
);

/**
 * @route   DELETE /api/v2/upload/:publicId
 * @desc    Delete image (Base64)
 * @access  Private
 */
router.delete("/:publicId", protect, (req, res) =>
  UploadController.deleteImage(req, res),
);

export default router;
