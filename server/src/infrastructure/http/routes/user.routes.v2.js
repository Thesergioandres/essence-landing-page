/**
 * User Permission Routes V2 - Hexagonal Architecture
 * Routes for God Mode / User Permission operations
 */
import express from "express";
import { god, protect } from "../../../../middleware/auth.middleware.js";
import {
  activateUser,
  extendSubscription,
  findUserByEmail,
  listUsers,
  pauseSubscription,
  resumeSubscription,
  suspendUser,
} from "../controllers/UserPermissionController.js";

const router = express.Router();

/**
 * @route   GET /api/v2/users
 * @desc    Lista todos los usuarios del sistema
 * @access  Private/God
 */
router.get("/", protect, god, listUsers);

/**
 * @route   GET /api/v2/users/email/:email
 * @desc    Busca un usuario por email
 * @access  Private/God
 */
router.get("/email/:email", protect, god, findUserByEmail);

/**
 * @route   PUT /api/v2/users/:id/activate
 * @desc    Activa un usuario y configura su suscripción
 * @access  Private/God
 */
router.put("/:id/activate", protect, god, activateUser);

/**
 * @route   PUT /api/v2/users/:id/suspend
 * @desc    Suspende un usuario
 * @access  Private/God
 */
router.put("/:id/suspend", protect, god, suspendUser);

/**
 * @route   PUT /api/v2/users/:id/extend
 * @desc    Extiende la suscripción de un usuario
 * @access  Private/God
 */
router.put("/:id/extend", protect, god, extendSubscription);

/**
 * @route   PUT /api/v2/users/:id/pause
 * @desc    Pausa la suscripción de un usuario
 * @access  Private/God
 */
router.put("/:id/pause", protect, god, pauseSubscription);

/**
 * @route   PUT /api/v2/users/:id/resume
 * @desc    Reanuda la suscripción de un usuario pausado
 * @access  Private/God
 */
router.put("/:id/resume", protect, god, resumeSubscription);

export default router;
