import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import InventoryEntry from "../models/InventoryEntry.js";
import Product from "../models/Product.js";
import Provider from "../models/Provider.js";

class InventoryRepository {
  async createEntry(businessId, data, userId) {
    const {
      product: productId,
      quantity,
      branch: branchId,
      provider: providerId,
      notes,
      unitCost: rawUnitCost,
    } = data;

    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product) throw new Error("Producto no encontrado");

    let branch = null;
    if (branchId) {
      branch = await Branch.findOne({ _id: branchId, business: businessId });
      if (!branch) throw new Error("Sede inválida");
    }

    if (providerId) {
      const provider = await Provider.findOne({
        _id: providerId,
        business: businessId,
      });
      if (!provider) throw new Error("Proveedor no encontrado");
    }

    const destination = branch ? "branch" : "warehouse";
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) throw new Error("Cantidad inválida");

    const currentCost = product.averageCost || product.purchasePrice || 0;
    const unitCost = Number(rawUnitCost) > 0 ? Number(rawUnitCost) : currentCost;
    const totalCost = qty * unitCost;

    const previousStock = product.totalStock || 0;
    const previousValue =
      product.totalInventoryValue && product.totalInventoryValue > 0
        ? product.totalInventoryValue
        : previousStock * currentCost;

    const newTotalStock = previousStock + qty;
    const usesFixedCosting = product.costingMethod === "fixed";
    const newTotalValue = usesFixedCosting
      ? newTotalStock * currentCost
      : previousValue + totalCost;
    const newAverageCost = usesFixedCosting
      ? currentCost
      : newTotalStock > 0
        ? newTotalValue / newTotalStock
        : unitCost;

    product.totalStock = newTotalStock;
    product.totalInventoryValue = newTotalValue;
    product.averageCost = newAverageCost;
    product.lastCostUpdate = new Date();

    if (destination === "branch") {
      await BranchStock.findOneAndUpdate(
        { business: businessId, branch: branch._id, product: product._id },
        { $inc: { quantity: qty } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else {
      product.warehouseStock = (product.warehouseStock || 0) + qty;
    }

    await product.save({ validateBeforeSave: false });

    const requestId =
      data.requestId ||
      `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = await InventoryEntry.create({
      business: businessId,
      branch: branch?._id || null,
      product: product._id,
      provider: providerId || null,
      user: userId,
      quantity: qty,
      unitCost,
      totalCost,
      averageCostAfter: newAverageCost,
      notes,
      destination,
      requestId,
      purchaseGroupId: data.purchaseGroupId || null,
      metadata: {
        previousAverageCost: previousStock > 0 ? previousValue / previousStock : currentCost,
        costingMethod: product.costingMethod || "average",
      },
    });

    return {
      entry,
      costInfo: {
        previousAverageCost:
          previousStock > 0
            ? previousValue / previousStock
            : product.purchasePrice,
        newAverageCost,
        totalInventoryValue: newTotalValue,
      },
    };
  }

  async listEntries(businessId, filters, page, limit) {
    const { productId, branchId, providerId, destination, startDate, endDate } =
      filters;
    const filter = { business: businessId, deleted: { $ne: true } };
    if (productId) filter.product = productId;
    if (branchId) filter.branch = branchId;
    if (providerId) filter.provider = providerId;
    if (destination) filter.destination = destination;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      InventoryEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("product", "name")
        .populate("branch", "name")
        .populate("provider", "name")
        .populate("user", "name email")
        .lean(),
      InventoryEntry.countDocuments(filter),
    ]);

    return {
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async updateEntry(businessId, entryId, data) {
    const entry = await InventoryEntry.findOne({
      _id: entryId,
      business: businessId,
      deleted: { $ne: true },
    });

    if (!entry) {
      throw new Error("Entrada de inventario no encontrada");
    }

    if (data.notes !== undefined) {
      entry.notes = data.notes;
    }

    if (data.provider !== undefined) {
      if (data.provider) {
        const provider = await Provider.findOne({
          _id: data.provider,
          business: businessId,
        });
        if (!provider) throw new Error("Proveedor no encontrado");
      }
      entry.provider = data.provider || null;
    }

    await entry.save();

    return { entry };
  }

  async deleteEntry(businessId, entryId, userId) {
    const entry = await InventoryEntry.findOne({
      _id: entryId,
      business: businessId,
      deleted: { $ne: true },
    });

    if (!entry) {
      throw new Error("Entrada de inventario no encontrada");
    }

    const product = await Product.findOne({
      _id: entry.product,
      business: businessId,
    });
    if (!product) throw new Error("Producto no encontrado");

    const qty = Number(entry.quantity) || 0;
    if (qty <= 0) {
      throw new Error("Cantidad inválida en la entrada");
    }

    if (entry.destination === "branch") {
      const branchStock = await BranchStock.findOne({
        business: businessId,
        branch: entry.branch,
        product: entry.product,
      });
      const branchQty = branchStock?.quantity || 0;
      if (branchQty < qty) {
        throw new Error("Stock insuficiente en la sede para revertir");
      }

      await BranchStock.findOneAndUpdate(
        { business: businessId, branch: entry.branch, product: entry.product },
        { $inc: { quantity: -qty } },
      );
    } else {
      const warehouseQty = product.warehouseStock || 0;
      if (warehouseQty < qty) {
        throw new Error("Stock insuficiente en bodega para revertir");
      }
      product.warehouseStock = warehouseQty - qty;
    }

    const totalStock = product.totalStock || 0;
    product.totalStock = Math.max(totalStock - qty, 0);

    const totalValue = product.totalInventoryValue || 0;
    const entryValue = Number(entry.totalCost) || 0;
    const newTotalValue = Math.max(totalValue - entryValue, 0);
    product.totalInventoryValue = newTotalValue;

    const usesFixedCosting = product.costingMethod === "fixed";
    product.averageCost = usesFixedCosting
      ? product.averageCost || product.purchasePrice || 0
      : product.totalStock > 0
        ? newTotalValue / product.totalStock
        : product.purchasePrice || 0;
    product.lastCostUpdate = new Date();

    await product.save({ validateBeforeSave: false });

    entry.deleted = true;
    entry.deletedAt = new Date();
    entry.deletedBy = userId || null;
    await entry.save();

    return {
      entry,
      revertedQuantity: qty,
      destination: entry.destination,
    };
  }
}

export default new InventoryRepository();
