/**
 * @file FinanceService.js
 * @description Pure Domain Service for financial calculations.
 * Contains all the "Money Trail" logic.
 * NO external dependencies allowed.
 */

export class FinanceService {
  /**
   * Calculates the price meant for the distributor (what they pay to admin).
   * @param {number} salePrice - The final public price
   * @param {number} profitPercentage - The distributor's commission % (e.g. 20)
   * @returns {number} The price the distributor pays
   */
  static calculateDistributorPrice(salePrice, profitPercentage) {
    if (salePrice < 0) throw new Error("Sale price cannot be negative");
    const percentage = profitPercentage || 20; // Default logic
    // Price for dist = SalePrice * (100 - Commission) / 100
    return salePrice * ((100 - percentage) / 100);
  }

  /**
   * Calculates the distributor's gross profit.
   * @param {number} salePrice
   * @param {number} distributorPrice
   * @param {number} quantity
   * @returns {number}
   */
  static calculateDistributorProfit(salePrice, distributorPrice, quantity) {
    return (salePrice - distributorPrice) * quantity;
  }

  /**
   * Calculates the Admin's gross profit.
   * @param {number} salePrice
   * @param {number} costBasis - The average cost or purchase price
   * @param {number} distributorProfit - The amount given to distributor
   * @param {number} quantity
   * @returns {number}
   */
  static calculateAdminProfit(
    salePrice,
    costBasis,
    distributorProfit,
    quantity,
  ) {
    const totalRevenue = salePrice * quantity;
    const totalCost = costBasis * quantity;
    // Revenue - Cost - DistributorShare
    return totalRevenue - totalCost - distributorProfit;
  }

  /**
   * Calculates Net Profit after all deductions.
   * @param {number} totalProfit - (AdminProfit + DistributorProfit) or just AdminProfit
   * @param {number} shippingCost
   * @param {number} additionalCosts
   * @param {number} discount
   * @returns {number}
   */
  static calculateNetProfit(
    totalProfit,
    shippingCost = 0,
    additionalCosts = 0,
    discount = 0,
  ) {
    // Note: The legacy analytics controller had a "magic rule" for shipping 710-720.
    // We explicitly DO NOT include that here to fix the data integrity issue.
    // We stick to the pure financial truth.
    return totalProfit - shippingCost - additionalCosts - discount;
  }

  /**
   * Calculates Profitability Percentage (Margin).
   * @param {number} netProfit
   * @param {number} totalSaleAmount
   * @returns {number}
   */
  static calculateProfitabilityPercentage(netProfit, totalSaleAmount) {
    if (totalSaleAmount <= 0) return 0;
    return (netProfit / totalSaleAmount) * 100;
  }
}
