/**
 * @file FinanceService.js
 * @description Pure Domain Service for financial calculations.
 * Contains all the "Money Trail" logic.
 * NO external dependencies allowed.
 */

export class FinanceService {
  /**
   * Resolves base commission percentage from config or fallback value.
   * @param {object | number | null} configOrValue
   * @param {number} fallback
   * @returns {number}
   */
  static resolveBaseCommissionPercentage(configOrValue, fallback = 20) {
    if (typeof configOrValue === "number") {
      return Number.isFinite(configOrValue) ? configOrValue : fallback;
    }
    const configValue = configOrValue?.baseCommissionPercentage;
    if (typeof configValue === "number" && Number.isFinite(configValue)) {
      return configValue;
    }
    return fallback;
  }
  /**
   * Calculates the price meant for the employee (what they pay to admin).
   * @param {number} salePrice - The final public price
   * @param {number} profitPercentage - The employee's commission % (e.g. 20)
   * @returns {number} The price the employee pays
   */
  static calculateEmployeePrice(salePrice, profitPercentage) {
    if (salePrice < 0) throw new Error("Sale price cannot be negative");
    const normalizedPercentage =
      typeof profitPercentage === "number" && Number.isFinite(profitPercentage)
        ? profitPercentage
        : 20;
    const percentage = Math.max(0, Math.min(95, normalizedPercentage));
    // Price for dist = SalePrice * (100 - Commission) / 100
    return salePrice * ((100 - percentage) / 100);
  }

  /**
   * Calculates the employee's gross profit.
   * @param {number} salePrice
   * @param {number} employeePrice
   * @param {number} quantity
   * @returns {number}
   */
  static calculateEmployeeProfit(salePrice, employeePrice, quantity) {
    return (salePrice - employeePrice) * quantity;
  }

  /**
   * Calculates the Admin's gross profit.
   * @param {number} salePrice
   * @param {number} costBasis - The average cost or purchase price
   * @param {number} employeeProfit - The amount given to employee
   * @param {number} quantity
   * @returns {number}
   */
  static calculateAdminProfit(
    salePrice,
    costBasis,
    employeeProfit,
    quantity,
  ) {
    const totalRevenue = salePrice * quantity;
    const totalCost = costBasis * quantity;
    // Revenue - Cost - EmployeeShare
    return totalRevenue - totalCost - employeeProfit;
  }

  /**
   * Calculates Net Profit after all deductions.
   * @param {number} totalProfit - (AdminProfit + EmployeeProfit) or just AdminProfit
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
