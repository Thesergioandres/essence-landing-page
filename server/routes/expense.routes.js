import express from "express";
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
} from "../controllers/expense.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, admin, getExpenses);
router.post("/", protect, admin, createExpense);

router.get("/:id", protect, admin, getExpenseById);
router.put("/:id", protect, admin, updateExpense);
router.delete("/:id", protect, admin, deleteExpense);

export default router;
