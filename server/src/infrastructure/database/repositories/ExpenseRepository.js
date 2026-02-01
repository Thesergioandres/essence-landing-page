import DefectiveProduct from "../../../../models/DefectiveProduct.js";
import Expense from "../../../../models/Expense.js";
import Sale from "../../../../models/Sale.js";

class ExpenseRepository {
  async create(businessId, data, userId) {
    const { type, category, amount, description, expenseDate } = data;

    const resolvedType =
      (typeof type === "string" && type.trim()) ||
      (typeof category === "string" && category.trim()) ||
      (typeof description === "string" && description.trim()) ||
      "";
    if (!resolvedType) throw new Error("El tipo de gasto es obligatorio");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0)
      throw new Error("El monto es inválido");

    const expense = await Expense.create({
      type: resolvedType.trim(),
      amount: parsedAmount,
      description: typeof description === "string" ? description.trim() : "",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdBy: userId,
      business: businessId,
    });

    return Expense.findById(expense._id)
      .populate("createdBy", "name email")
      .lean();
  }

  async findByBusiness(businessId, filters) {
    const { startDate, endDate, type, category } = filters;
    const filter = businessId ? { business: businessId } : {};
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
      if (endDate) {
        end.setUTCHours(28, 59, 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      filter.expenseDate = { $gte: start, $lte: end };
      saleFilter.saleDate = { $gte: start, $lte: end };
      defectiveFilter.reportDate = { $gte: start, $lte: end };
    }

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

    const expensePromise = Expense.find(filter)
      .populate("createdBy", "name email")
      .lean();
    const salePromise = fetchSales
      ? Sale.find({
          ...saleFilter,
          $or: [{ additionalCost: { $gt: 0 } }, { discount: { $gt: 0 } }],
        })
          .populate("distributor", "name")
          .populate("product", "name")
          .lean()
      : Promise.resolve([]);
    const defectivePromise = fetchDefective
      ? DefectiveProduct.find(defectiveFilter)
          .populate("product", "name purchasePrice")
          .lean()
      : Promise.resolve([]);

    const [expenses, sales, defectiveProducts] = await Promise.all([
      expensePromise,
      salePromise,
      defectivePromise,
    ]);

    const saleExpenses = sales.flatMap((sale) => {
      const items = [];
      if (sale.additionalCost > 0) {
        items.push({
          _id: `sale-cost-${sale._id}`,
          type: "Costo de Venta",
          amount: sale.additionalCost,
          description: `Costo adicional - ${sale.product?.name || "Producto"} (Venta #${sale._id})`,
          expenseDate: sale.saleDate,
          createdBy: sale.distributor || null,
          business: sale.business,
          synthetic: true,
        });
      }
      if (sale.discount > 0) {
        items.push({
          _id: `sale-discount-${sale._id}`,
          type: "Descuento",
          amount: sale.discount,
          description: `Descuento aplicado - ${sale.product?.name || "Producto"} (Venta #${sale._id})`,
          expenseDate: sale.saleDate,
          createdBy: sale.distributor || null,
          business: sale.business,
          synthetic: true,
        });
      }
      return items;
    });

    const defectiveExpenses = defectiveProducts.map((def) => ({
      _id: `defective-${def._id}`,
      type: "Pérdida - Defectuoso",
      amount: (def.product?.purchasePrice || 0) * (def.quantity || 1),
      description: `Producto defectuoso - ${def.product?.name || "Producto"} (x${def.quantity})`,
      expenseDate: def.reportDate,
      createdBy: def.reportedBy || null,
      business: def.business,
      synthetic: true,
    }));

    return [...expenses, ...saleExpenses, ...defectiveExpenses].sort(
      (a, b) => new Date(b.expenseDate) - new Date(a.expenseDate),
    );
  }

  async update(expenseId, businessId, updates) {
    return Expense.findOneAndUpdate(
      { _id: expenseId, business: businessId },
      updates,
      { new: true },
    )
      .populate("createdBy", "name email")
      .lean();
  }

  async delete(expenseId, businessId) {
    return Expense.findOneAndDelete({
      _id: expenseId,
      business: businessId,
    }).lean();
  }
}

export default new ExpenseRepository();
