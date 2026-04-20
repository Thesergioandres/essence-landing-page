import { CommissionPolicyService } from "../../domain/services/CommissionPolicyService.js";
import User from "../database/models/User.js";

const DEFAULT_BASE_COMMISSION =
  CommissionPolicyService.getDefaultBaseCommission();

export const getEmployeeCommissionInfo = async (
  employeeId,
  _businessId = null,
) => {
  try {
    const user = await User.findById(employeeId)
      .select(
        "fixedCommissionOnly isCommissionFixed customCommissionRate baseCommissionPercentage",
      )
      .lean();

    const isCommissionFixed = Boolean(
      user?.isCommissionFixed || user?.fixedCommissionOnly,
    );

    if (isCommissionFixed) {
      const normalizedFixedRate =
        CommissionPolicyService.normalizeCommissionRate(
          user?.customCommissionRate,
          DEFAULT_BASE_COMMISSION,
        );

      return {
        position: null,
        bonusCommission: 0,
        profitPercentage: normalizedFixedRate,
        baseCommissionPercentage: normalizedFixedRate,
        periodStart: null,
        periodEnd: null,
        totalEmployees: 0,
        isCommissionFixed: true,
        customCommissionRate: normalizedFixedRate,
      };
    }

    const normalizedBaseRate = CommissionPolicyService.normalizeCommissionRate(
      user?.baseCommissionPercentage,
      DEFAULT_BASE_COMMISSION,
    );

    return {
      position: null,
      bonusCommission: 0,
      profitPercentage: normalizedBaseRate,
      baseCommissionPercentage: normalizedBaseRate,
      level: null,
      periodStart: null,
      periodEnd: null,
      totalEmployees: 0,
      isCommissionFixed: false,
      customCommissionRate: null,
    };
  } catch (error) {
    console.error("Error calculando comisión employee:", error);
    return {
      position: null,
      bonusCommission: 0,
      profitPercentage: DEFAULT_BASE_COMMISSION,
      baseCommissionPercentage: DEFAULT_BASE_COMMISSION,
      periodStart: null,
      periodEnd: null,
      totalEmployees: 0,
      isCommissionFixed: false,
      customCommissionRate: null,
    };
  }
};

export const getEmployeeProfitPercentage = async (
  employeeId,
  businessId = null,
) => {
  try {
    const info = await getEmployeeCommissionInfo(employeeId, businessId);
    return info.profitPercentage;
  } catch (error) {
    console.error("Error calculando porcentaje employee:", error);
    return DEFAULT_BASE_COMMISSION;
  }
};

export const calculateEmployeePrice = async (
  purchasePrice,
  employeeId,
  businessId = null,
) => {
  const profitPercentage = await getEmployeeProfitPercentage(
    employeeId,
    businessId,
  );

  const employeePrice = purchasePrice / (1 - profitPercentage / 100);

  return Math.round(employeePrice);
};
