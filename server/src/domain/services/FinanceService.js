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
   *
   * Supported signatures:
   * 1) Legacy (sales flows): calculateEmployeePrice(salePrice, profitPercentage)
   * 2) Dynamic product pricing: calculateEmployeePrice(salePrice, manualPrice, baseCommissionPercentage)
   *
   * @returns {number}
   */
  static calculateEmployeePrice(
    salePriceInput,
    manualPriceOrProfitPercentage = null,
    baseCommissionPercentage = null,
  ) {
    // Legacy behavior used by sales flows.
    if (arguments.length < 3) {
      const salePrice = Number(salePriceInput);
      if (!Number.isFinite(salePrice) || salePrice < 0) {
        throw new Error("Sale price cannot be negative");
      }

      const normalizedPercentage =
        typeof manualPriceOrProfitPercentage === "number" &&
        Number.isFinite(manualPriceOrProfitPercentage)
          ? manualPriceOrProfitPercentage
          : 20;
      const percentage = Math.max(0, Math.min(95, normalizedPercentage));

      // Price for employee = SalePrice - EmployeeCommission
      return (
        salePrice -
        this.calculateEmployeeCommissionAmount(salePrice, percentage)
      );
    }

    const salePrice = Number(salePriceInput);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      throw new Error("Sale price cannot be negative");
    }

    const manualPrice =
      typeof manualPriceOrProfitPercentage === "number" &&
      Number.isFinite(manualPriceOrProfitPercentage) &&
      manualPriceOrProfitPercentage >= 0
        ? manualPriceOrProfitPercentage
        : null;

    if (manualPrice !== null) {
      return manualPrice;
    }

    const normalizedBaseCommission = this.resolveBaseCommissionPercentage(
      baseCommissionPercentage,
      20,
    );
    const percentage = Math.max(0, Math.min(95, normalizedBaseCommission));

    // Dynamic formula for products in automatic mode.
    const employeeCommission = this.calculateEmployeeCommissionAmount(
      salePrice,
      percentage,
    );
    return salePrice - employeeCommission;
  }

  /**
   * Calculates the commission amount earned by employee from sale price.
   * @param {number} salePrice
   * @param {number} commissionPercentage
   * @param {number} quantity
   * @returns {number}
   */
  static calculateEmployeeCommissionAmount(
    salePrice,
    commissionPercentage,
    quantity = 1,
  ) {
    const normalizedSalePrice = Number(salePrice);
    const normalizedPercentage = Number(commissionPercentage);
    const normalizedQuantity = Number(quantity);

    if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice < 0) {
      throw new Error("Sale price cannot be negative");
    }

    const percentage = Number.isFinite(normalizedPercentage)
      ? Math.max(0, Math.min(95, normalizedPercentage))
      : 0;

    const qty =
      Number.isFinite(normalizedQuantity) && normalizedQuantity > 0
        ? normalizedQuantity
        : 1;

    return normalizedSalePrice * (percentage / 100) * qty;
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
   * @param {number} employeeProfit - Commission amount given to employee
   * @param {number} quantity
   * @returns {number}
   */
  static calculateAdminProfit(salePrice, costBasis, employeeProfit, quantity) {
    const totalRevenue = salePrice * quantity;
    const totalCost = costBasis * quantity;
    const employeeCommissionAmount =
      Number.isFinite(Number(employeeProfit)) && Number(employeeProfit) > 0
        ? Number(employeeProfit)
        : 0;

    // Revenue - Cost - EmployeeCommission (owner sale => employeeCommission=0)
    return totalRevenue - totalCost - employeeCommissionAmount;
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
