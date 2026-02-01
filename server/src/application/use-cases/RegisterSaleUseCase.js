import { v4 as uuidv4 } from "uuid";
import { FinanceService } from "../../domain/services/FinanceService.js";
import { InventoryService } from "../../domain/services/InventoryService.js";
import { ProductRepository } from "../../infrastructure/database/repositories/ProductRepository.js";
import { SaleRepository } from "../../infrastructure/database/repositories/SaleRepository.js";

export class RegisterSaleUseCase {
  constructor() {
    this.saleRepository = new SaleRepository();
    this.productRepository = new ProductRepository();
  }

  /**
   * Orchestrates the BULK sale registration process.
   * @param {Object} input - DTO containing sale details
   * @param {Array} input.items - Array of { productId, quantity, salePrice }
   * @param {Object} input.user - User performing the action
   * @param {mongoose.ClientSession} session - Active transaction session
   */
  async execute(input, session) {
    const {
      user,
      items, // Expecting Array
      businessId,
      distributorId,
      notes,
      paymentMethodId,
      deliveryMethodId,
      shippingCost,
      distributorProfitPercentage = 20,
    } = input;

    // 1. Validation (Business Rules)
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No items provided for sale.");
    }

    const saleGroupId = uuidv4(); // Unique ID for this batch
    const results = [];
    let totalTransactionAmount = 0;
    let netTransactionProfit = 0;

    // 2. Loop Items
    for (const item of items) {
      const { productId, quantity, salePrice } = item;

      if (quantity <= 0)
        throw new Error(`Invalid quantity for product ${productId}`);

      // A. Load Product (Atomic read within session recommended if locking needed, but findById is fast)
      // Using session here ensures we see the latest state if modified in this transaction
      const product = await this.productRepository.findById(productId);

      if (!product) throw new Error(`Product not found: ${productId}`);

      // B. Check Stock (Pure Domain Logic)
      const hasStock = InventoryService.hasSufficientStock(
        product.totalStock,
        quantity,
      );
      if (!hasStock) {
        throw new Error(
          `Insufficient stock for ${product.name}. Requested: ${quantity}, Available: ${product.totalStock}`,
        );
      }

      // C. Financial Calculations
      const costBasis = product.averageCost || product.purchasePrice || 0;

      const distributorPrice = FinanceService.calculateDistributorPrice(
        salePrice,
        distributorProfitPercentage,
      );
      const distributorProfit = FinanceService.calculateDistributorProfit(
        salePrice,
        distributorPrice,
        quantity,
      );
      const adminProfit = FinanceService.calculateAdminProfit(
        salePrice,
        costBasis,
        distributorProfit,
        quantity,
      );

      const totalProfit = distributorProfit + adminProfit; // Simplified per item

      // Note: Net Profit is usually calculated on the Total, deducting shipping ONCE.
      // Here we store item-level stats.

      // D. Deduct Stock (Infra)
      await this.productRepository.updateStock(productId, -quantity, session);

      // E. Create Sale Record (Infra)
      const saleData = {
        business: businessId,
        distributor: distributorId || user.id,
        product: productId,
        productName: product.name,
        quantity,
        salePrice,
        purchasePrice: product.purchasePrice,
        averageCostAtSale: costBasis,
        distributorPrice,
        distributorProfit,
        adminProfit,
        totalProfit,
        netProfit: totalProfit, // Item level net profit placeholder
        distributorProfitPercentage,
        notes,
        saleDate: input.saleDate || new Date(),
        saleGroupId, // Link them!
        paymentMethod: paymentMethodId,
        deliveryMethod: deliveryMethodId,
        shippingCost: 0, // We handle shipping once on the group usually, or legacy stores it on every item?
        // Legacy often stored full shipping on first item or divided?
        // We'll leave it 0 here and maybe handle it in a separate logic if needed,
        // or better, just attribute it to the context of the sale.
        // For now, let's keep it simple.
      };

      const createdSale = await this.saleRepository.create(saleData, session);
      results.push(createdSale);

      totalTransactionAmount += salePrice * quantity;
      netTransactionProfit += totalProfit;
    }

    // Adjust Net Profit with Shipping (Once)
    // This return object is what the Frontend receives
    return {
      saleGroupId,
      totalAmount: totalTransactionAmount,
      totalItems: results.length,
      netProfit: netTransactionProfit - (shippingCost || 0),
      adminProfit: results.reduce((sum, r) => sum + r.adminProfit, 0),
    };
  }
}
