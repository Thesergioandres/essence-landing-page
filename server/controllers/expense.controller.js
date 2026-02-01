import { invalidateCache } from "../middleware/cache.middleware.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import Expense from "../models/Expense.js";
import Sale from "../models/Sale.js";

const resolveBusinessId = (req) =>
  req.businessId ||
  req.headers["x-business-id"] ||
  req.query.businessId ||
  req.body.businessId;

// @desc    Registrar un gasto (inversión)
// @route   POST /api/expenses
// @access  Private/Admin
export const createExpense = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

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
      business: businessId,
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
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { startDate, endDate, type, category } = req.query;

    // NUCLEAR FIX: Exclude specific technical categories from DB fetch
    // "Costo de Venta" (Shipping/Extra Costs) - Handled in Sales Logic
    // "Pérdida - Defectuoso" (Defects) - Handled in Defective Logic
    // "Publicidad" and others MUST remain.
    // NUCLEAR FIX: Include ALL categories as requested by user
    // "Costo de Venta" (Shipping) - Previously excluded, now INCLUDED
    const excludedCategories = []; // Allow everything
    const baseFilter = {
      // No exclude filter
    };

    const filter = businessId
      ? { business: businessId, ...baseFilter }
      : { ...baseFilter };

    const saleFilter = businessId ? { business: businessId } : {};
    const defectiveFilter = businessId ? { business: businessId } : {};

    const resolvedType =
      (typeof type === "string" && type.trim()) ||
      (typeof category === "string" && category.trim()) ||
      "";

    if (resolvedType) {
      filter.$or = [{ type: resolvedType }, { category: resolvedType }];
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();

      // TIMEZONE FIX: Expenses are stored in UTC. Colombia is UTC-5.
      // End of "Jan 27" local time is "Jan 28 04:59:59 UTC".
      // We extend the window to capture these late-day expenses.
      if (endDate) {
        end.setUTCHours(28, 59, 59, 999); // 23h + 5h = 28h (spills to next day 04:59)
      } else {
        end.setHours(23, 59, 59, 999);
      }

      filter.expenseDate = { $gte: start, $lte: end };
      saleFilter.saleDate = { $gte: start, $lte: end };
      defectiveFilter.reportDate = { $gte: start, $lte: end };
    }

    // 1. Fetch Standard Expenses
    const expensePromise = Expense.find(filter)
      .populate("createdBy", "name email")
      .lean();

    // 2. Fetch Sales with additional costs
    let fetchSales = true;
    let fetchDefective = true;

    if (
      resolvedType &&
      ![
        "Costo de Venta",
        "Descuento",
        "Envío",
        "Pérdida - Defectuoso",
      ].includes(resolvedType)
    ) {
      fetchSales = false;
      fetchDefective = false;
    }

    // NUCLEAR FIX: Do NOT exclude "Costo de Venta" globally
    // if (resolvedType === "Costo de Venta") {
    //   fetchSales = false;
    // }

    const salePromise = fetchSales
      ? Sale.find({
          ...saleFilter,
          $or: [
            { totalAdditionalCosts: { $gt: 0 } },
            { totalShippingCosts: { $gt: 0 } },
            { totalDiscounts: { $gt: 0 } },
          ],
        })
          .select(
            "saleDate createdAt totalAdditionalCosts totalShippingCosts totalDiscounts code",
          )
          .lean()
      : Promise.resolve([]);

    // 3. Fetch Defective Product Losses
    const defectivePromise = fetchDefective
      ? DefectiveProduct.find({
          ...defectiveFilter,
          status: { $regex: /^confirmado$/i },
          // lossAmount: { $gt: 0 }, // Comentado por si acaso es 0 o null y queremos verlo debuggeando
        })
          .select("reportDate createdAt lossAmount product status")
          .populate("product", "name")
          .lean()
      : Promise.resolve([]);

    const [expenses, sales, defectives] = await Promise.all([
      expensePromise,
      salePromise,
      defectivePromise,
    ]);

    // Map Sales to Virtual Expenses
    const saleExpenses = [];
    sales.forEach((sale) => {
      // Usamos saleDate como preferida, pero fallback a createdAt si es nula/inválida
      // Nota: saleDate suele ser string ISO o Date en DB.
      const date = sale.saleDate || sale.createdAt;

      // NUCLEAR FIX: "Costo de Venta" (Additional Costs) are double counted in Net Profit.
      // We explicitly skip creating them as virtual expenses.
      if (
        sale.totalAdditionalCosts > 0 &&
        (!resolvedType || resolvedType === "Costo Adicional Envío")
      ) {
        saleExpenses.push({
          _id: `sale-cost-${sale._id}`,
          type: "Costo Adicional Envío",
          amount: sale.totalAdditionalCosts,
          description: `Costos adiccionales - Venta #${sale.code}`,
          expenseDate: date,
          isVirtual: true,
        });
      }
      if (
        sale.totalShippingCosts > 0 &&
        (!resolvedType || resolvedType === "Envío")
      ) {
        saleExpenses.push({
          _id: `sale-ship-${sale._id}`,
          type: "Envío",
          amount: sale.totalShippingCosts,
          description: `Envío - Venta #${sale.code}`,
          expenseDate: date,
          isVirtual: true,
        });
      }
      if (
        sale.totalDiscounts > 0 &&
        (!resolvedType || resolvedType === "Descuento")
      ) {
        saleExpenses.push({
          _id: `sale-disc-${sale._id}`,
          type: "Descuento",
          amount: sale.totalDiscounts,
          description: `Descuento aplicado - Venta #${sale.code}`,
          expenseDate: date,
          isVirtual: true,
        });
      }
    });

    // Map Defectives to Virtual Expenses
    const defectiveExpenses = defectives.map((def) => ({
      _id: `def-${def._id}`,
      type: "Pérdida - Defectuoso",
      amount: def.lossAmount,
      description: `Pérdida por defecto - ${def.product?.name || "Producto"}`,
      expenseDate: def.reportDate || def.createdAt,
      isVirtual: true,
    }));

    // Merge and Sort
    let finalVirtualExpenses = [...saleExpenses, ...defectiveExpenses];
    if (resolvedType) {
      finalVirtualExpenses = finalVirtualExpenses.filter(
        (e) => e.type === resolvedType,
      );
    }

    const finalExpenses = [...expenses, ...finalVirtualExpenses];
    finalExpenses.sort(
      (a, b) => new Date(b.expenseDate) - new Date(a.expenseDate),
    );

    res.json({ expenses: finalExpenses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener un gasto por ID
// @route   GET /api/expenses/:id
// @access  Private/Admin
export const getExpenseById = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const expense = await Expense.findOne({
      _id: req.params.id,
      ...(businessId ? { business: businessId } : {}),
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

// @desc    Actualizar un gasto
// @route   PUT /api/expenses/:id
// @access  Private/Admin
export const updateExpense = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

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

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...(businessId ? { business: businessId } : {}) },
      update,
      {
        new: true,
      },
    )
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
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const expense = await Expense.findOne({
      _id: req.params.id,
      ...(businessId ? { business: businessId } : {}),
    });

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
