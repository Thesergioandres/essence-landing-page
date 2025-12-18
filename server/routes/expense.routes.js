import express from "express";
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
} from "../controllers/expense.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";
import { cacheMiddleware } from "../middleware/cache.middleware.js";

const router = express.Router();

router.get("/", protect, admin, cacheMiddleware(120, "expenses"), getExpenses);
router.post("/", protect, admin, createExpense);

router.get(
  "/:id",
  protect,
  admin,
  cacheMiddleware(300, "expense"),
  getExpenseById
);
router.put("/:id", protect, admin, updateExpense);
router.delete("/:id", protect, admin, deleteExpense);

export default router;
