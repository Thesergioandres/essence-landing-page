import BranchStock from "../../../../models/BranchStock.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Product from "../../../../models/Product.js";
import StockTransfer from "../../../../models/StockTransfer.js";
import User from "../../../../models/User.js";

class StockRepository {
  async assignToDistributor(businessId, distributorId, productId, quantity) {
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product || product.warehouseStock < quantity) {
      throw new Error("Stock insuficiente");
    }

    let distStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
      business: businessId,
    });

    if (distStock) {
      distStock.quantity += quantity;
      await distStock.save();
    } else {
      distStock = await DistributorStock.create({
        distributor: distributorId,
        product: productId,
        quantity,
        business: businessId,
      });
    }

    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        business: businessId,
        warehouseStock: { $gte: quantity },
      },
      { $inc: { warehouseStock: -quantity } },
      { new: true },
    );

    if (!updated) {
      distStock.quantity -= quantity;
      await distStock.save();
      throw new Error("Fallo en actualización concurrente");
    }

    const user = await User.findById(distributorId);
    if (user && !user.assignedProducts.includes(productId)) {
      user.assignedProducts.push(productId);
      await user.save();
    }

    return { distStock, product: updated };
  }

  async withdrawFromDistributor(
    businessId,
    distributorId,
    productId,
    quantity,
  ) {
    const stockUpdate = await DistributorStock.findOneAndUpdate(
      { _id: distributorId, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true },
    );

    if (!stockUpdate) throw new Error("Stock insuficiente");

    const product = await Product.findOneAndUpdate(
      { _id: productId, business: businessId },
      { $inc: { warehouseStock: quantity } },
      { new: true },
    );

    return { stockUpdate, product };
  }

  async getDistributorStock(businessId, distributorId) {
    const stock = await DistributorStock.find({
      distributor: distributorId,
      business: businessId,
    })
      .populate(
        "product",
        "name image purchasePrice distributorPrice clientPrice",
      )
      .populate("distributor", "name email")
      .lean();

    const user = await User.findById(distributorId).select("assignedProducts");
    const assignedIds = (user?.assignedProducts || []).map((id) =>
      id.toString(),
    );
    const existingIds = stock.map((s) => s.product._id.toString());
    const missingIds = assignedIds.filter((id) => !existingIds.includes(id));

    if (missingIds.length > 0) {
      const missing = await Product.find({
        _id: { $in: missingIds },
        business: businessId,
      })
        .select("name image purchasePrice distributorPrice clientPrice")
        .lean();
      missing.forEach((p) =>
        stock.push({
          _id: `synthetic-${p._id}`,
          distributor: { _id: distributorId },
          product: p,
          quantity: 0,
          lowStockAlert: 5,
          isLowStock: true,
          isSynthetic: true,
        }),
      );
    }

    return stock.map((item) => ({
      ...item,
      isLowStock: item.quantity <= (item.lowStockAlert || 0),
    }));
  }

  async getBranchStock(businessId, branchId) {
    const filter = businessId ? { business: businessId } : {};
    if (branchId) filter.branch = branchId;

    return BranchStock.find(filter)
      .populate("branch", "name")
      .populate(
        "product",
        "name image purchasePrice distributorPrice clientPrice",
      )
      .lean();
  }

  async getAlerts(businessId) {
    const lowWarehouse = await Product.find({
      business: businessId,
      $expr: { $lte: ["$warehouseStock", "$lowStockAlert"] },
    }).lean();

    const lowDist = await DistributorStock.find({ business: businessId })
      .populate("product", "name")
      .populate("distributor", "name email")
      .lean();

    return {
      warehouseAlerts: lowWarehouse,
      distributorAlerts: lowDist.filter((i) => i.quantity <= i.lowStockAlert),
    };
  }

  async createTransfer(
    businessId,
    fromDistId,
    fromBranchId,
    toDistId,
    toBranchId,
    productId,
    quantity,
    userId,
  ) {
    return StockTransfer.create({
      business: businessId,
      product: productId,
      fromDistributor: fromDistId || null,
      fromBranch: fromBranchId || null,
      toDistributor: toDistId || null,
      toBranch: toBranchId || null,
      quantity,
      createdBy: userId,
      status: "pending",
    });
  }
}

export default new StockRepository();
