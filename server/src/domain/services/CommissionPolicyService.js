const MAX_COMMISSION_PERCENTAGE = 95;
const MIN_FIXED_COMMISSION_PERCENTAGE = 30;
const DEFAULT_VARIABLE_COMMISSION_PERCENTAGE = 20;

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class CommissionPolicyService {
  static resolveDistributorCommission({
    isCommissionFixed = false,
    customCommissionRate = null,
    baseCommissionRate = null,
    requestedCommissionRate = DEFAULT_VARIABLE_COMMISSION_PERCENTAGE,
    bonusCommission = 0,
  } = {}) {
    if (isCommissionFixed) {
      const fixedCandidate =
        toFiniteNumber(customCommissionRate) ??
        toFiniteNumber(baseCommissionRate) ??
        MIN_FIXED_COMMISSION_PERCENTAGE;

      const protectedFixedRate = clamp(
        fixedCandidate,
        MIN_FIXED_COMMISSION_PERCENTAGE,
        MAX_COMMISSION_PERCENTAGE,
      );

      return {
        baseCommissionPercentage: protectedFixedRate,
        distributorCommissionBonus: 0,
        isCommissionFixed: true,
      };
    }

    const variableCandidate =
      toFiniteNumber(baseCommissionRate) ??
      toFiniteNumber(requestedCommissionRate) ??
      DEFAULT_VARIABLE_COMMISSION_PERCENTAGE;

    const normalizedVariableRate = clamp(
      variableCandidate,
      0,
      MAX_COMMISSION_PERCENTAGE,
    );

    const normalizedBonus = clamp(toFiniteNumber(bonusCommission) ?? 0, 0, 100);

    return {
      baseCommissionPercentage: normalizedVariableRate,
      distributorCommissionBonus: normalizedBonus,
      isCommissionFixed: false,
    };
  }
}

export default CommissionPolicyService;
