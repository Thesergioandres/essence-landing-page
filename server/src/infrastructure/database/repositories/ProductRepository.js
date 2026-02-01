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
    return Product.find({ business: businessId, ...filter })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Update stock atomically.
   * STRICTLY requires a session.
   * @param {string} productId
   * @param {number} quantityChange - Negative to reduce, Positive to add
   * @param {mongoose.ClientSession} session - Mandatory
   * @returns {Promise<Object>} Updated document
   */
  async updateStock(productId, quantityChange, session) {
    if (!session) {
      throw new Error(
        "CRITICAL: Transaction Session is required for Stock Update.",
      );
    }

    // Atomic update of stock and inventory value
    // We assume cost calculation happens in domain service or we pull it first.
    // Ideally, we should pull the product to get averageCost if we need to update totalInventoryValue.
    // For this simple method, we just update quantity first.
    // BUT, maintaining totalInventoryValue is critical.

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error("Product not found");

    const cost = product.averageCost || product.purchasePrice || 0;
    const valueChange = quantityChange * cost;

    product.totalStock = (product.totalStock || 0) + quantityChange;
    product.totalInventoryValue =
      (product.totalInventoryValue || 0) + valueChange;

    await product.save({ session });
    return product.toObject();
  }

  /**
   * Create a new product
   * @param {Object} data
   * @param {mongoose.ClientSession} session
   */
  async create(data, session) {
    const [product] = await Product.create([data], { session });
    return product;
  }
}
