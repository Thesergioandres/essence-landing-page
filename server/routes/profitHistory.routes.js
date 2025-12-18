import express from "express";
import {
  backfillProfitHistoryFromSales,
  createProfitEntry,
  getComparativeAnalysis,
  getProfitSummary,
  getUserBalance,
  getUserProfitHistory,
} from "../controllers/profitHistory.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas protegidas (admin o propio usuario)
router.get("/user/:userId", protect, getUserProfitHistory);
router.get("/balance/:userId", protect, getUserBalance);

// Rutas admin
router.get("/summary", protect, admin, getProfitSummary);
router.get("/comparative", protect, admin, getComparativeAnalysis);
router.post("/", protect, admin, createProfitEntry);
router.post("/backfill/sales", protect, admin, backfillProfitHistoryFromSales);

export default router;
