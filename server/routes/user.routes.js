import express from "express";
import { getAllUsers } from "../controllers/auth.controller.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// @route   GET /api/users
// @desc    Obtener todos los usuarios
// @access  Private/Admin
router.get("/", protect, admin, getAllUsers);

export default router;
