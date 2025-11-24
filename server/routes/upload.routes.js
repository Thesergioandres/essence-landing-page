import express from "express";
import upload from "../config/multer.js";
import { deleteImage, uploadImage } from "../controllers/upload.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas protegidas (solo admin)
router.post("/", protect, admin, upload.single("image"), uploadImage);
router.delete("/:publicId", protect, admin, deleteImage);

export default router;
