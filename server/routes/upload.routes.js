import express from "express";
import upload from "../config/multer.js";
import { deleteImage, uploadImage } from "../controllers/upload.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Subir imagen: solo requiere login (sin requirePermission para permitir upload durante registro)
router.post("/", protect, upload.single("image"), uploadImage);
// Eliminar imagen: solo requiere login (las imágenes Base64 se eliminan automáticamente con los productos)
router.delete("/:publicId", protect, deleteImage);

export default router;
