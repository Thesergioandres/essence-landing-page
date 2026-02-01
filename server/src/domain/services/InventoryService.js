/**
 * @file InventoryService.js
 * @description Pure Domain Service for Inventory Logic.
 */
export class InventoryService {
  /**
   * Checks if there is sufficient stock directly on the product (Warehouse Stock).
   * @param {number} currentStock
   * @param {number} quantityRequested
   * @returns {boolean}
   */
  static hasSufficientStock(currentStock, quantityRequested) {
    if (typeof currentStock !== "number" || currentStock < 0) return false;
    if (quantityRequested <= 0) return true; // Zero requirement always met
    return currentStock >= quantityRequested;
  }

  /**
   * Checks if stock can be adjusted. (e.g., prevent going below zero if strict).
   * @param {number} currentStock
   * @param {number} changeAmount (Negative for deduction)
   * @returns {number} New stock level
   * @throws {Error} If insufficient
   */
  static calculateNewStockLevel(currentStock, changeAmount) {
    const newLevel = currentStock + changeAmount;
    if (newLevel < 0) {
      throw new Error(
        `Insufficient stock. Current: ${currentStock}, Requested Deduction: ${Math.abs(changeAmount)}`,
      );
    }
    return newLevel;
  }
}
