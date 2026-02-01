import { ProductRepository } from "../../infrastructure/database/repositories/ProductRepository.js";

export class CreateProductUseCase {
  constructor() {
    this.productRepository = new ProductRepository();
  }

  /**
   * Creates a new product.
   * @param {Object} productData
   * @param {mongoose.ClientSession} session
   */
  async execute(productData, session) {
    // 1. Basic Validation (Could be in Domain Entity)
    if (!productData.name) throw new Error("Product name is required");
    if (productData.purchasePrice < 0)
      throw new Error("Purchase price cannot be negative");

    // 2. Persistence
    return this.productRepository.create(productData, session);
  }
}
