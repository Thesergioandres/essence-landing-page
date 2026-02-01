import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import InventoryEntry from "../../../../models/InventoryEntry.js";
import Product from "../../../../models/Product.js";
import Provider from "../../../../models/Provider.js";

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

    const unitCost =
      Number(rawUnitCost) > 0
        ? Number(rawUnitCost)
        : product.purchasePrice || 0;
    const totalCost = qty * unitCost;

    const previousStock = product.totalStock || 0;
    const currentCost = product.averageCost || product.purchasePrice || 0;
    const previousValue =
      product.totalInventoryValue && product.totalInventoryValue > 0
        ? product.totalInventoryValue
        : previousStock * currentCost;

    const newTotalStock = previousStock + qty;
    const newTotalValue = previousValue + totalCost;
    const newAverageCost =
      newTotalStock > 0 ? newTotalValue / newTotalStock : unitCost;

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
    const filter = { business: businessId };
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
}

export default new InventoryRepository();
