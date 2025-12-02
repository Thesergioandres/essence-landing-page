import express from "express";
import {
  checkAndEvaluatePeriod,
  evaluatePeriod,
  getAchievements,
  getAdjustedCommission,
  getConfig,
  getDistributorStats,
  getRanking,
  getWinners,
  markBonusPaid,
  updateConfig,
} from "../controllers/gamification.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";
import { cacheMiddleware } from "../middleware/cache.middleware.js";

const router = express.Router();

// Rutas de configuración (solo admin)
router
  .route("/config")
  .get(protect, admin, cacheMiddleware(600, 'gamification'), getConfig)
  .put(protect, admin, updateConfig);

// Rutas de ranking y ganadores con caché de 2 minutos
router.get("/ranking", protect, cacheMiddleware(120, 'gamification'), getRanking);
router.get("/winners", protect, cacheMiddleware(300, 'gamification'), getWinners);
router.get("/achievements", protect, cacheMiddleware(120, 'gamification'), getAchievements);
router.get("/commission/:distributorId", protect, cacheMiddleware(120, 'gamification'), getAdjustedCommission);

// Rutas de evaluación (solo admin)
router.post("/evaluate", protect, admin, evaluatePeriod);
router.post("/check-period", protect, admin, checkAndEvaluatePeriod);
router.put("/winners/:winnerId/pay", protect, admin, markBonusPaid);

// Rutas de estadísticas de distribuidor con caché de 2 minutos
router.get("/stats/:distributorId", protect, cacheMiddleware(120, 'gamification'), getDistributorStats);

export default router;
