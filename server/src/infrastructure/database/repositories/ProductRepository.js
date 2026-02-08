import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import InventoryEntry from "../../../../models/InventoryEntry.js";
import User from "../../../../models/User.js";
import Product from "../models/Product.js";

export class ProductRepository {
  /**
   * Find product by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return Product.findById(id).lean();
  }

  /**
   * Find all products for a business
   * @param {string} businessId
   * @param {Object} filter
   * @returns {Promise<Array>}
   */
  async findAll(businessId, filter = {}) {
    const normalizedFilter = { business: businessId, ...filter };
    if (typeof normalizedFilter.isDeleted === "undefined") {
      normalizedFilter.isDeleted = { $ne: true };
    }

    return Product.find(normalizedFilter)
      .populate("category", "name color icon")
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Update stock atomically.
   * Optional session support for both standalone and replica set MongoDB.
   *
   * ⚠️ NOTE: This updates totalStock (global counter) only.
   * For warehouse-specific updates, use updateWarehouseStock().
   *
   * @param {string} productId
   * @param {number} quantityChange - Negative to reduce, Positive to add
   * @param {mongoose.ClientSession} session - Optional (required for replica sets)
   * @returns {Promise<Object>} Updated document
   */
  async updateStock(productId, quantityChange, session) {
    const query = Product.findById(productId);
    const product = session ? await query.session(session) : await query;
    if (!product) throw new Error("Product not found");

    const cost = product.averageCost || product.purchasePrice || 0;
    const valueChange = quantityChange * cost;

    product.totalStock = (product.totalStock || 0) + quantityChange;
    product.totalInventoryValue =
      (product.totalInventoryValue || 0) + valueChange;

    // ℹ️ averageCost intentionally remains unchanged during sales.
    // It only updates when NEW inventory is received at a different price.

    await product.save(session ? { session } : {});
    return product.toObject();
  }

  /**
   * Update warehouse stock specifically (for admin sales).
   * 🎯 FIX TASK 1: Deduct from warehouse when admin makes direct sales.
   *
   * @param {string} productId
   * @param {number} quantityChange - Negative to reduce, Positive to add
   * @param {mongoose.ClientSession} session - Optional (required for replica sets)
   * @returns {Promise<Object>} Updated document
   */
  async updateWarehouseStock(productId, quantityChange, session) {
    const query = Product.findById(productId);
    const product = session ? await query.session(session) : await query;
    if (!product) throw new Error("Product not found");

    product.warehouseStock = (product.warehouseStock || 0) + quantityChange;

    if (product.warehouseStock < 0) {
      throw new Error(
        `Insufficient warehouse stock for ${product.name}. Available: ${product.warehouseStock + Math.abs(quantityChange)}, Requested: ${Math.abs(quantityChange)}`,
      );
    }

    await product.save(session ? { session } : {});
    return product.toObject();
  }

  /**
   * Create a new product
   * @param {Object} data
   * @param {mongoose.ClientSession} session - Optional
   */
  async create(data, session) {
    const [product] = session
      ? await Product.create([data], { session })
      : await Product.create([data]);
    return product;
  }

  /**
   * Update a product by ID
   * @param {string} id
   * @param {string} businessId
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async update(id, businessId, updateData) {
    const product = await Product.findOneAndUpdate(
      { _id: id, business: businessId },
      { $set: updateData },
      { new: true, runValidators: true },
    );
    return product;
  }

  /**
   * Update a product and register manual stock adjustments when needed.
   * @param {string} id
   * @param {string} businessId
   * @param {Object} updateData
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async updateWithManualStock(id, businessId, updateData, userId) {
    const product = await Product.findOne({ _id: id, business: businessId });
    if (!product) return null;

    const hasTotalStock = Object.prototype.hasOwnProperty.call(
      updateData,
      "totalStock",
    );
    const hasWarehouseStock = Object.prototype.hasOwnProperty.call(
      updateData,
      "warehouseStock",
    );

    if (hasTotalStock || hasWarehouseStock) {
      const distStocks = await DistributorStock.find({
        product: id,
        business: businessId,
      });
      const totalDistributor = distStocks.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0,
      );

      const bodegaBranches = await Branch.find({
        business: businessId,
        $or: [{ name: /^bodega$/i }, { isWarehouse: true }],
      })
        .select("_id")
        .lean();
      const bodegaIds = bodegaBranches.map((branch) => branch._id);

      const branchStocks = await BranchStock.find({
        product: id,
        business: businessId,
        ...(bodegaIds.length > 0 ? { branch: { $nin: bodegaIds } } : {}),
      });
      const totalBranch = branchStocks.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0,
      );

      const currentWarehouse = product.warehouseStock || 0;
      let desiredWarehouse = currentWarehouse;
      const providedWarehouse = hasWarehouseStock
        ? Number(updateData.warehouseStock)
        : null;
      const warehouseChanged =
        hasWarehouseStock &&
        !Number.isNaN(providedWarehouse) &&
        providedWarehouse !== currentWarehouse;

      if (warehouseChanged) {
        desiredWarehouse = Number(providedWarehouse);
      } else if (hasTotalStock) {
        const desiredTotal = Number(updateData.totalStock);
        desiredWarehouse = desiredTotal - totalDistributor - totalBranch;
      }

      if (Number.isNaN(desiredWarehouse) || desiredWarehouse < 0) {
        throw new Error("El stock en bodega no puede ser negativo");
      }

      updateData.warehouseStock = desiredWarehouse;
      updateData.totalStock = desiredWarehouse + totalDistributor + totalBranch;

      const diff = desiredWarehouse - currentWarehouse;
      if (diff !== 0) {
        const unitCost = product.averageCost || product.purchasePrice || 0;
        const totalCost = diff * unitCost;

        if (!userId) {
          throw new Error("Usuario requerido para registrar ajuste de stock");
        }

        await InventoryEntry.create({
          business: businessId,
          product: product._id,
          user: userId,
          type: "adjustment",
          quantity: diff,
          unitCost,
          totalCost,
          averageCostAfter: product.averageCost || unitCost,
          notes: "Ajuste manual de stock desde panel de edicion",
          destination: "warehouse",
          metadata: {
            previousWarehouseStock: currentWarehouse,
            newWarehouseStock: desiredWarehouse,
          },
        });
      }
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, business: businessId },
      { $set: updateData },
      { new: true, runValidators: true },
    );
    return updatedProduct;
  }

  /**
   * Delete a product by ID
   * @param {string} id
   * @param {string} businessId
   * @returns {Promise<Object>}
   */
  async delete(id, businessId) {
    const product = await Product.findOne({ _id: id, business: businessId });
    if (!product) {
      throw new Error("Producto no encontrado");
    }

    const deletedAt = new Date();

    await Promise.all([
      BranchStock.deleteMany({ business: businessId, product: id }),
      DistributorStock.deleteMany({ business: businessId, product: id }),
      InventoryEntry.updateMany(
        { business: businessId, product: id, deleted: { $ne: true } },
        { $set: { deleted: true, deletedAt } },
      ),
      User.updateMany(
        { business: businessId, assignedProducts: id },
        { $pull: { assignedProducts: id } },
      ),
    ]);

    product.isDeleted = true;
    product.deletedAt = deletedAt;
    product.totalStock = 0;
    product.warehouseStock = 0;
    product.totalInventoryValue = 0;

    await product.save();
    return product;
  }
}
