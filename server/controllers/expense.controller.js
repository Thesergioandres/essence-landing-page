import Expense from "../models/Expense.js";

// @desc    Registrar un gasto (inversión)
// @route   POST /api/expenses
// @access  Private/Admin
export const createExpense = async (req, res) => {
  try {
    const { category, amount, description, expenseDate } = req.body;

    if (!category || typeof category !== "string") {
      return res.status(400).json({ message: "La categoría es obligatoria" });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: "El monto es inválido" });
    }

    const expense = await Expense.create({
      category: category.trim(),
      amount: parsedAmount,
      description: typeof description === "string" ? description.trim() : "",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdBy: req.user.id,
    });

    const populated = await Expense.findById(expense._id)
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({ expense: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Listar gastos
// @route   GET /api/expenses
// @access  Private/Admin
export const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;

    const filter = {};

    if (typeof category === "string" && category.trim()) {
      filter.category = category.trim();
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
    const { category, amount, description, expenseDate } = req.body;

    const update = {};

    if (category !== undefined) {
      if (!category || typeof category !== "string") {
        return res.status(400).json({ message: "La categoría es obligatoria" });
      }
      update.category = category.trim();
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
