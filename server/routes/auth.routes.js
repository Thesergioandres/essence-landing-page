import express from "express";
import {
    createAdmin,
    getProfile,
    login,
    register,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas públicas
router.post("/register", register);
router.post("/login", login);
router.post("/create-admin", createAdmin);

// Rutas protegidas
router.get("/profile", protect, getProfile);

export default router;
