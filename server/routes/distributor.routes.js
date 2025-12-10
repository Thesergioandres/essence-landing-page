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

// Rutas que distribuidores también pueden usar
router.get("/", protect, getDistributors); // Distribuidores pueden ver la lista (para transferencias)

// Rutas solo para admin
router.post("/", protect, admin, createDistributor);
router.get("/:id", protect, admin, getDistributorById);
router.put("/:id", protect, admin, updateDistributor);
router.delete("/:id", protect, admin, deleteDistributor);
router.patch("/:id/toggle-active", protect, admin, toggleDistributorActive);

export default router;
