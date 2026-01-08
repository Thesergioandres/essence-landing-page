import express from "express";
import { getAllUsers } from "../controllers/auth.controller.js";
import {
  getGlobalMetrics,
  getSubscriptionsSummary,
} from "../controllers/god.controller.js";
import {
  activateUser,
  deleteUser,
  extendSubscription,
  findUserByEmail,
  listUsers,
  pauseSubscription,
  resumeSubscription,
  suspendUser,
} from "../controllers/userAccess.controller.js";
import {
  cleanupInconsistentSubscriptions,
  runSubscriptionChecks,
} from "../jobs/subscription.cron.js";
import { admin, god, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// @route   GET /api/users
// @desc    Obtener todos los usuarios
// @access  Private/Admin
router.get("/", protect, admin, getAllUsers);

// @route   GET /api/users/find/:email
// @desc    Buscar usuario por email
// @access  Private
router.get("/find/:email", protect, findUserByEmail);

// Panel GOD - Métricas globales
router.get("/god/metrics", protect, god, getGlobalMetrics);
router.get("/god/subscriptions", protect, god, getSubscriptionsSummary);

// Panel GOD - Cron jobs manuales
router.post("/god/run-subscription-checks", protect, god, async (_req, res) => {
  try {
    const results = await runSubscriptionChecks();
    res.json({ success: true, results });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error ejecutando verificación", error: error.message });
  }
});

router.post("/god/cleanup-subscriptions", protect, god, async (_req, res) => {
  try {
    const results = await cleanupInconsistentSubscriptions();
    res.json({ success: true, results });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error limpiando suscripciones", error: error.message });
  }
});

// Panel GOD - Gestión de usuarios
router.get("/god/all", protect, god, listUsers);
router.post("/god/:id/activate", protect, god, activateUser);
router.post("/god/:id/suspend", protect, god, suspendUser);
router.post("/god/:id/delete", protect, god, deleteUser);
router.post("/god/:id/extend", protect, god, extendSubscription);
router.post("/god/:id/pause", protect, god, pauseSubscription);
router.post("/god/:id/resume", protect, god, resumeSubscription);

export default router;
