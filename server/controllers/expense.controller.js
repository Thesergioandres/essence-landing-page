import { invalidateCache } from "../middleware/cache.middleware.js";
import Expense from "../models/Expense.js";

// @desc    Registrar un gasto (inversión)
// @route   POST /api/expenses
// @access  Private/Admin
export const createExpense = async (req, res) => {
  try {
    const { type, category, amount, description, expenseDate } = req.body;

    const resolvedType =
      (typeof type === "string" && type.trim()) ||
      (typeof category === "string" && category.trim()) ||
      (typeof description === "string" && description.trim()) ||
      "";

    if (!resolvedType) {
      return res
        .status(400)
        .json({ message: "El tipo de gasto es obligatorio" });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: "El monto es inválido" });
    }

    const expense = await Expense.create({
      type: resolvedType.trim(),
      amount: parsedAmount,
      description: typeof description === "string" ? description.trim() : "",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdBy: req.user.id,
    });

    const populated = await Expense.findById(expense._id)
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({ expense: populated });

    await invalidateCache("cache:expenses:*");
    await invalidateCache("cache:expense:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Listar gastos
// @route   GET /api/expenses
// @access  Private/Admin
export const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, type, category } = req.query;

    const filter = {};

    const resolvedType =
      (typeof type === "string" && type.trim()) ||
      (typeof category === "string" && category.trim()) ||
      "";

    if (resolvedType) {
      // Compatibilidad: en datos antiguos puede estar como `category`
      filter.$or = [{ type: resolvedType }, { category: resolvedType }];
    }

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate("createdBy", "name email")
      .sort({ expenseDate: -1, createdAt: -1 })
      .lean();

    res.json({ expenses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener un gasto por ID
// @route   GET /api/expenses/:id
// @access  Private/Admin
export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate("createdBy", "name email")
      .lean();

    if (!expense) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    res.json({ expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar un gasto
// @route   PUT /api/expenses/:id
// @access  Private/Admin
export const updateExpense = async (req, res) => {
  try {
    const { type, category, amount, description, expenseDate } = req.body;

    const update = {};

    if (type !== undefined) {
      if (!type || typeof type !== "string") {
        return res
          .status(400)
          .json({ message: "El tipo de gasto es obligatorio" });
      }
      update.type = type.trim();
    }

    // Legacy: si aún llega `category`, lo interpretamos como `type`
    if (category !== undefined && type === undefined) {
      if (!category || typeof category !== "string") {
        return res
          .status(400)
          .json({ message: "El tipo de gasto es obligatorio" });
      }
      update.type = category.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ message: "El monto es inválido" });
      }
      update.amount = parsedAmount;
    }

    if (description !== undefined) {
      update.description =
        typeof description === "string" ? description.trim() : "";
    }

    if (expenseDate !== undefined) {
      update.expenseDate = expenseDate ? new Date(expenseDate) : new Date();
    }

    const expense = await Expense.findByIdAndUpdate(req.params.id, update, {
      new: true,
    })
      .populate("createdBy", "name email")
      .lean();

    if (!expense) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    res.json({ expense });

    await invalidateCache("cache:expenses:*");
    await invalidateCache("cache:expense:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Eliminar un gasto
// @route   DELETE /api/expenses/:id
// @access  Private/Admin
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    await expense.deleteOne();
    res.json({ message: "Gasto eliminado" });

    await invalidateCache("cache:expenses:*");
    await invalidateCache("cache:expense:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
