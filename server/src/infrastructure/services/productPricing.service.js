import { CommissionPolicyService } from "../../domain/services/CommissionPolicyService.js";
import { FinanceService } from "../../domain/services/FinanceService.js";
import GamificationConfig from "../database/models/GamificationConfig.js";

const DEFAULT_BASE_COMMISSION =
  CommissionPolicyService.getDefaultBaseCommission();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const toProductObject = (product) => {
  if (!product || typeof product !== "object") {
    return product;
  }

  if (typeof product.toObject === "function") {
    return product.toObject();
  }

  return product;
};

export const getBusinessBaseCommissionPercentage = async (businessId) => {
  let config = null;

  if (businessId) {
    try {
      config = await GamificationConfig.findOne({
        business: businessId,
      }).lean();
    } catch (error) {
      config = null;
    }
  }

  if (!config) {
    config = await GamificationConfig.findOne().lean();
  }

  return CommissionPolicyService.normalizeCommissionRate(
    FinanceService.resolveBaseCommissionPercentage(
      config,
      DEFAULT_BASE_COMMISSION,
    ),
    DEFAULT_BASE_COMMISSION,
  );
};

export const resolveManualEmployeePrice = (product) => {
  const manualValue = toFiniteNumber(product?.employeePriceManualValue);
  if (manualValue !== null && manualValue >= 0) {
    return manualValue;
  }

  const isLegacyManual = product?.employeePriceManual === true;
  const legacyEmployeePrice = toFiniteNumber(product?.employeePrice);

  if (
    isLegacyManual &&
    legacyEmployeePrice !== null &&
    legacyEmployeePrice >= 0
  ) {
    return legacyEmployeePrice;
  }

  return null;
};

const resolveSalePrice = (product) => {
  const clientPrice = toFiniteNumber(product?.clientPrice);
  if (clientPrice !== null && clientPrice >= 0) {
    return clientPrice;
  }

  const suggestedPrice = toFiniteNumber(product?.suggestedPrice);
  if (suggestedPrice !== null && suggestedPrice >= 0) {
    return suggestedPrice;
  }

  return 0;
};

export const calculateAutomaticEmployeePrice = (
  salePrice,
  baseCommissionPercentage,
) => {
  const normalizedSalePrice = toFiniteNumber(salePrice);
  if (normalizedSalePrice === null || normalizedSalePrice < 0) {
    return 0;
  }

  return FinanceService.calculateEmployeePrice(
    normalizedSalePrice,
    null,
    baseCommissionPercentage,
  );
};

export const applyDynamicEmployeePricingToProduct = (
  product,
  baseCommissionPercentage,
) => {
  const resolvedProduct = toProductObject(product);

  if (!resolvedProduct || typeof resolvedProduct !== "object") {
    return resolvedProduct;
  }

  const manualPrice = resolveManualEmployeePrice(resolvedProduct);
  const salePrice = resolveSalePrice(resolvedProduct);

  const computedEmployeePrice =
    manualPrice !== null
      ? manualPrice
      : calculateAutomaticEmployeePrice(salePrice, baseCommissionPercentage);

  const isManual = manualPrice !== null;

  return {
    ...resolvedProduct,
    employeePrice: computedEmployeePrice,
    employeePriceManual: isManual,
    employeePriceManualValue: isManual ? manualPrice : null,
    baseCommissionPercentage,
    employeePriceMode: isManual ? "manual" : "automatic",
  };
};

export const applyDynamicEmployeePricingToProducts = (
  products,
  baseCommissionPercentage,
) => {
  if (!Array.isArray(products) || products.length === 0) {
    return products;
  }

  return products.map((product) =>
    applyDynamicEmployeePricingToProduct(product, baseCommissionPercentage),
  );
};
