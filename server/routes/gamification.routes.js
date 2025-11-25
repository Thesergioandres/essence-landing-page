import express from "express";
import {
  getConfig,
  updateConfig,
  getRanking,
  evaluatePeriod,
  getWinners,
  getDistributorStats,
  markBonusPaid,
  getAchievements,
} from "../controllers/gamification.controller.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas de configuración (solo admin)
router.route("/config").get(protect, admin, getConfig).put(protect, admin, updateConfig);

// Rutas de ranking y ganadores (acceso protegido)
router.get("/ranking", protect, getRanking);
router.get("/winners", protect, getWinners);
router.get("/achievements", protect, getAchievements);

// Rutas de evaluación (solo admin)
router.post("/evaluate", protect, admin, evaluatePeriod);
router.put("/winners/:winnerId/pay", protect, admin, markBonusPaid);

// Rutas de estadísticas de distribuidor
router.get("/stats/:distributorId", protect, getDistributorStats);

export default router;
