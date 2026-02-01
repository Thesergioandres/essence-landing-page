import Sale from "../models/Sale.js";

export class SaleRepository {
  /**
   * Creates a new Sale document.
   * @param {Object} saleData - The raw sale data (DTO)
   * @param {mongoose.ClientSession} session - MANDATORY MongoDB session for ACID transaction
   * @returns {Promise<Object>} The created sale document
   * @throws {Error} If session is missing or creation fails
   */
  async create(saleData, session) {
    if (!session) {
      throw new Error(
        "CRITICAL: Transaction Session is required for creating a Sale.",
      );
    }

    // We pass [saleData] as an array because Model.create() with options requires it,
    // or we use new Model(data).save({ session }).
    // Using create method: Model.create([doc], { session }) returns array.
    const [sale] = await Sale.create([saleData], { session });

    if (!sale) {
      throw new Error("Failed to persist Sale document.");
    }

    return sale;
  }

  /**
   * Finds a sale by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return Sale.findById(id).populate("product").populate("distributor").lean();
  }

  /**
   * Finds sales by specialized filter
   * @param {Object} filter
   * @returns {Promise<Array>}
   */
  async find(filter = {}) {
    return Sale.find(filter).lean();
  }
}
