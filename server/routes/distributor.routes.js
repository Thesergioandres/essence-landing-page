import express from "express";
import {
  createDistributor,
  deleteDistributor,
  getDistributorById,
  getDistributors,
  toggleDistributorActive,
  updateDistributor,
} from "../controllers/distributor.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Todas las rutas son solo para admin
router.post("/", protect, admin, createDistributor);
router.get("/", protect, admin, getDistributors);
router.get("/:id", protect, admin, getDistributorById);
router.put("/:id", protect, admin, updateDistributor);
router.delete("/:id", protect, admin, deleteDistributor);
router.patch("/:id/toggle-active", protect, admin, toggleDistributorActive);

export default router;
