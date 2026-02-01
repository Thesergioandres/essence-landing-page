import { InventoryService } from "../../domain/services/InventoryService.js";
import { ProductRepository } from "../../infrastructure/database/repositories/ProductRepository.js";

export class UpdateStockUseCase {
  constructor() {
    this.productRepository = new ProductRepository();
  }

  /**
   * Updates warehouse stock for a product.
   * @param {Object} input - { productId, quantityChange, businessId }
   * @param {mongoose.ClientSession} session - Mandatory
   */
  async execute(input, session) {
    const { productId, quantityChange, businessId } = input;

    // 1. Fetch current state
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // 2. Domain Logic Validation (If deducting)
    if (quantityChange < 0) {
      const currentStock = product.totalStock || 0; // Assuming totalStock is the main warehouse stock for this use case
      InventoryService.calculateNewStockLevel(currentStock, quantityChange);
    }

    // 3. Persist Change (Infrastructure)
    const updatedProduct = await this.productRepository.updateStock(
      productId,
      quantityChange,
      session,
    );

    return updatedProduct;
  }
}
