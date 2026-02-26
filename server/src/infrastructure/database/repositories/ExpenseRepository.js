import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import DefectiveProduct from "../../../../models/DefectiveProduct.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Expense from "../../../../models/Expense.js";
import Product from "../../../../models/Product.js";
import ProfitHistory from "../../../../models/ProfitHistory.js";
import Sale from "../../../../models/Sale.js";
import { ProductRepository } from "./ProductRepository.js";

class ExpenseRepository {
  constructor() {
    this.productRepository = new ProductRepository();
  }

  buildError(message, statusCode = 400) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
  }

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

    await ProfitHistory.create({
      business: businessId,
      user: userId,
      type: "ajuste",
      amount: -Math.abs(parsedAmount),
      description: `Gasto: ${resolvedType.trim()}`,
      date: expense.expenseDate || new Date(),
      metadata: {
        expenseId: expense._id,
        expenseType: resolvedType.trim(),
      },
    });

    return Expense.findById(expense._id)
      .populate("createdBy", "name email")
      .lean();
  }

  async createInventoryWithdrawal(businessId, data, userId) {
    const {
      productId,
      branchId,
      distributorId,
      quantity,
      reason,
      expenseDate,
      locationType,
    } = data || {};

    if (!productId) throw this.buildError("Producto requerido");

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw this.buildError("Cantidad invalida");
    }

    let resolvedLocationType =
      locationType === "branch"
        ? "branch"
        : locationType === "distributor"
          ? "distributor"
          : locationType === "warehouse"
            ? "warehouse"
            : distributorId
              ? "distributor"
              : branchId
                ? "branch"
                : "warehouse";

    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product) throw this.buildError("Producto no encontrado", 404);

    let branch = null;
    let distributor = null;

    if (resolvedLocationType === "branch") {
      if (!branchId) throw this.buildError("Sede requerida");
      branch = await Branch.findOne({ _id: branchId, business: businessId });
      if (!branch) throw this.buildError("Sede invalida", 404);

      if (branch.isWarehouse) {
        resolvedLocationType = "warehouse";
        branch = null;
      }
    }

    if (resolvedLocationType === "branch") {
      const branchStock = await BranchStock.findOneAndUpdate(
        {
          business: businessId,
          branch: branchId,
          product: productId,
          quantity: { $gte: qty },
        },
        { $inc: { quantity: -qty } },
        { new: true },
      );

      if (!branchStock) {
        throw this.buildError("Stock insuficiente en la sede seleccionada");
      }
    } else if (resolvedLocationType === "distributor") {
      if (!distributorId) throw this.buildError("Distribuidor requerido");
      const distStock = await DistributorStock.findOneAndUpdate(
        {
          business: businessId,
          distributor: distributorId,
          product: productId,
          quantity: { $gte: qty },
        },
        { $inc: { quantity: -qty } },
        { new: true },
      );

      if (!distStock) {
        throw this.buildError(
          "Stock insuficiente en el distribuidor seleccionado",
        );
      }
      distributor = distStock.distributor;
    } else {
      const available = product.warehouseStock || 0;
      if (available < qty) {
        throw this.buildError("Stock insuficiente en bodega");
      }
      await this.productRepository.updateWarehouseStock(productId, -qty);
    }

    await this.productRepository.updateStock(productId, -qty);

    const unitCost = product.purchasePrice || product.averageCost || 0;
    const totalCost = unitCost * qty;
    const safeReason =
      typeof reason === "string" && reason.trim() ? reason.trim() : "Retiro";
    const locationLabel = branch
      ? branch.name
      : resolvedLocationType === "distributor"
        ? "Distribuidor"
        : "Bodega";

    const expense = await Expense.create({
      type: "Retiro de Inventario",
      category: "inventario",
      amount: totalCost,
      description: `Retiro de Inventario - ${safeReason} - ${product.name} x${qty} (${locationLabel})`,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdBy: userId,
      business: businessId,
      product: product._id,
      quantity: qty,
      sourceType: resolvedLocationType,
      sourceBranch: branch ? branch._id : null,
      sourceDistributor: distributor || null,
    });

    await ProfitHistory.create({
      business: businessId,
      user: userId,
      type: "ajuste",
      amount: -Math.abs(totalCost),
      product: product._id,
      description: `Retiro de Inventario: ${product.name} x${qty} (${safeReason})`,
      date: expense.expenseDate || new Date(),
      metadata: {
        expenseId: expense._id,
        eventName: "inventory_withdrawal",
        productId,
        branchId: branch ? branch._id : null,
        distributorId: distributor || null,
        quantity: qty,
        unitCost,
      },
    });

    return Expense.findById(expense._id)
      .populate("createdBy", "name email")
      .lean();
  }

  async findByBusiness(businessId, filters) {
    const { startDate, endDate, type, category } = filters;
    const filter = businessId ? { business: businessId } : {};
    const saleFilter = businessId ? { business: businessId } : {};
    const defectiveFilter = businessId
      ? {
          business: businessId,
          status: { $in: ["confirmado", "procesado"] },
          lossAmount: { $gt: 0 },
        }
      : {
          status: { $in: ["confirmado", "procesado"] },
          lossAmount: { $gt: 0 },
        };

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
      amount:
        Number(def.lossAmount) ||
        (def.product?.purchasePrice || 0) * (def.quantity || 1),
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
    const updated = await Expense.findOneAndUpdate(
      { _id: expenseId, business: businessId },
      updates,
      { new: true },
    )
      .populate("createdBy", "name email")
      .lean();

    if (updated) {
      const resolvedType =
        (typeof updated.type === "string" && updated.type.trim()) ||
        (typeof updated.category === "string" && updated.category.trim()) ||
        (typeof updated.description === "string" &&
          updated.description.trim()) ||
        "Gasto";

      const amountValue = Number(updated.amount) || 0;
      const dateStart = updated.expenseDate
        ? new Date(updated.expenseDate)
        : null;
      const dateEnd = updated.expenseDate
        ? new Date(updated.expenseDate)
        : null;

      if (dateStart && dateEnd) {
        dateStart.setHours(0, 0, 0, 0);
        dateEnd.setHours(23, 59, 59, 999);
      }

      const fallbackFilter = {
        business: businessId,
        type: "ajuste",
        amount: -Math.abs(amountValue),
        description: `Gasto: ${resolvedType}`,
        ...(updated.createdBy
          ? {
              user:
                typeof updated.createdBy === "object"
                  ? updated.createdBy._id
                  : updated.createdBy,
            }
          : {}),
        ...(dateStart && dateEnd
          ? { date: { $gte: dateStart, $lte: dateEnd } }
          : {}),
      };

      const entry = await ProfitHistory.findOne({
        business: businessId,
        $or: [
          { "metadata.expenseId": updated._id },
          { "metadata.expenseId": String(updated._id) },
          fallbackFilter,
        ],
      });

      if (entry) {
        entry.amount = -Math.abs(amountValue);
        entry.description = `Gasto: ${resolvedType}`;
        entry.date = updated.expenseDate || entry.date;
        entry.metadata = {
          ...(entry.metadata || {}),
          expenseId: updated._id,
          expenseType: resolvedType,
        };
        await entry.save();
      } else if (updated.createdBy) {
        await ProfitHistory.create({
          business: businessId,
          user:
            typeof updated.createdBy === "object"
              ? updated.createdBy._id
              : updated.createdBy,
          type: "ajuste",
          amount: -Math.abs(amountValue),
          description: `Gasto: ${resolvedType}`,
          date: updated.expenseDate || new Date(),
          metadata: {
            expenseId: updated._id,
            expenseType: resolvedType,
          },
        });
      }
    }

    return updated;
  }

  async delete(expenseId, businessId) {
    const deleted = await Expense.findOneAndDelete({
      _id: expenseId,
      business: businessId,
    }).lean();

    if (deleted) {
      if (
        deleted.type === "Retiro de Inventario" &&
        deleted.product &&
        Number(deleted.quantity) > 0
      ) {
        const restoreQty = Number(deleted.quantity) || 0;
        if (deleted.sourceType === "branch" && deleted.sourceBranch) {
          await BranchStock.findOneAndUpdate(
            {
              business: businessId,
              branch: deleted.sourceBranch,
              product: deleted.product,
            },
            { $inc: { quantity: restoreQty } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        } else if (
          deleted.sourceType === "distributor" &&
          deleted.sourceDistributor
        ) {
          await DistributorStock.findOneAndUpdate(
            {
              business: businessId,
              distributor: deleted.sourceDistributor,
              product: deleted.product,
            },
            { $inc: { quantity: restoreQty } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        } else {
          await this.productRepository.updateWarehouseStock(
            deleted.product,
            restoreQty,
          );
        }

        await this.productRepository.updateStock(deleted.product, restoreQty);
      }

      const resolvedType =
        (typeof deleted.type === "string" && deleted.type.trim()) ||
        (typeof deleted.category === "string" && deleted.category.trim()) ||
        (typeof deleted.description === "string" &&
          deleted.description.trim()) ||
        "Gasto";
      const amountValue = Number(deleted.amount) || 0;
      const dateStart = deleted.expenseDate
        ? new Date(deleted.expenseDate)
        : null;
      const dateEnd = deleted.expenseDate
        ? new Date(deleted.expenseDate)
        : null;

      if (dateStart && dateEnd) {
        dateStart.setHours(0, 0, 0, 0);
        dateEnd.setHours(23, 59, 59, 999);
      }

      await ProfitHistory.deleteMany({
        business: businessId,
        $or: [
          { "metadata.expenseId": deleted._id },
          { "metadata.expenseId": String(deleted._id) },
          {
            type: "ajuste",
            amount: -Math.abs(amountValue),
            description: `Gasto: ${resolvedType}`,
            ...(deleted.createdBy ? { user: deleted.createdBy } : {}),
            ...(dateStart && dateEnd
              ? { date: { $gte: dateStart, $lte: dateEnd } }
              : {}),
          },
        ],
      });
    }

    return deleted;
  }

  async cleanupOrphanProfitHistory(businessId) {
    const expenses = await Expense.find({ business: businessId })
      .select("type category description amount expenseDate")
      .lean();

    const normalizeType = (value) =>
      typeof value === "string" ? value.trim() : "";

    const expenseKeySet = new Set(
      expenses.map((exp) => {
        const expType =
          normalizeType(exp.type) ||
          normalizeType(exp.category) ||
          normalizeType(exp.description) ||
          "";
        const expAmount = Math.abs(Number(exp.amount) || 0);
        const expDate = exp.expenseDate
          ? new Date(exp.expenseDate).toISOString().slice(0, 10)
          : "";
        return `${expType}|${expAmount}|${expDate}`;
      }),
    );

    const candidates = await ProfitHistory.find({
      business: businessId,
      type: "ajuste",
      description: { $regex: /^Gasto:/ },
      "metadata.expenseId": { $exists: false },
    })
      .select("_id description amount date")
      .lean();

    const toDelete = candidates
      .filter((entry) => {
        const rawType =
          typeof entry.description === "string"
            ? entry.description.replace(/^Gasto:\s*/i, "")
            : "";
        const entryType = normalizeType(rawType);
        const entryAmount = Math.abs(Number(entry.amount) || 0);
        const entryDate = entry.date
          ? new Date(entry.date).toISOString().slice(0, 10)
          : "";
        const key = `${entryType}|${entryAmount}|${entryDate}`;
        return !expenseKeySet.has(key);
      })
      .map((entry) => entry._id);

    if (toDelete.length === 0) {
      return { deletedCount: 0 };
    }

    const result = await ProfitHistory.deleteMany({ _id: { $in: toDelete } });
    return { deletedCount: result?.deletedCount || 0 };
  }
}

export default new ExpenseRepository();
