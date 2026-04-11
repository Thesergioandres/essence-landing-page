const MAX_COMMISSION_PERCENTAGE = 95;
const MIN_FIXED_COMMISSION_PERCENTAGE = 30;
const DEFAULT_VARIABLE_COMMISSION_PERCENTAGE = 20;

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class CommissionPolicyService {
  static getDefaultBaseCommission() {
    return DEFAULT_VARIABLE_COMMISSION_PERCENTAGE;
  }

  static normalizeCommissionRate(
    rate,
    fallback = DEFAULT_VARIABLE_COMMISSION_PERCENTAGE,
  ) {
    const candidate = toFiniteNumber(rate);
    const fallbackValue = toFiniteNumber(fallback);
    const base = candidate !== null ? candidate : fallbackValue;
    return clamp(
      base ?? DEFAULT_VARIABLE_COMMISSION_PERCENTAGE,
      0,
      MAX_COMMISSION_PERCENTAGE,
    );
  }

  static getEvaluationPeriodRange(config, now = new Date()) {
    let startDate;
    let endDate;

    const cycle = config?.cycle?.duration;
    if (cycle === "quarterly") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
    } else if (cycle === "annual") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (cycle === "custom" && config?.cycle?.customDays) {
      startDate = new Date(
        now.getTime() - config.cycle.customDays * 24 * 60 * 60 * 1000,
      );
      endDate = now;
    } else if (config?.evaluationPeriod === "biweekly") {
      startDate = config.currentPeriodStart || now;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 15);
    } else if (config?.evaluationPeriod === "weekly") {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
    }

    return { startDate, endDate };
  }

  static resolveDistributorCommission({
    isCommissionFixed = false,
    customCommissionRate = null,
    baseCommissionRate = null,
    requestedCommissionRate = DEFAULT_VARIABLE_COMMISSION_PERCENTAGE,
    bonusCommission = 0,
  } = {}) {
    if (isCommissionFixed) {
      const explicitCustomRate = toFiniteNumber(customCommissionRate);
      const protectedFixedRate =
        explicitCustomRate !== null
          ? clamp(explicitCustomRate, 0, MAX_COMMISSION_PERCENTAGE)
          : clamp(
              toFiniteNumber(baseCommissionRate) ??
                MIN_FIXED_COMMISSION_PERCENTAGE,
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
