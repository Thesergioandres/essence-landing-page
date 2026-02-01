import express from "express";
import { login, register } from "../controllers/AuthController.js";
// import { protect } from "../../../../../middleware/auth.middleware.js"; // If needed for logout/me

const router = express.Router();

router.post("/login", login);
router.post("/register", register);

export default router;
