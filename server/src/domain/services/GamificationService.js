/**
 * @file GamificationService.js
 * @description Pure Domain Service for gamification calculations.
 * Contains points math, tier resolution, and bonus eligibility logic.
 * NO external dependencies allowed (no DB, no HTTP, no infra).
 */

const DEFAULT_TIERS = [
  { name: "Bronce", minPoints: 25000, bonusPercentage: 1 },
  { name: "Plata", minPoints: 50000, bonusPercentage: 3 },
  { name: "Oro", minPoints: 100000, bonusPercentage: 5 },
];

const DEFAULT_AMOUNT_PER_POINT = 1000;

export class GamificationService {
  /**
   * Returns the default tier definitions.
   * @returns {Array<{ name: string, minPoints: number, bonusPercentage: number }>}
   */
  static getDefaultTiers() {
    return [...DEFAULT_TIERS];
  }

  /**
   * Calculates the points earned for a given sale amount.
   *
   * Formula: floor(saleAmount / amountPerPoint) * multiplier
   *
   * @param {number} saleAmount - Total sale value (e.g., 150000 COP)
   * @param {number} multiplier - Product-level multiplier (default 1, max 10)
   * @param {number} amountPerPoint - How much currency per 1 point (default 1000)
   * @returns {{ points: number, rawPoints: number, multiplier: number }}
   */
  static calculatePointsForSale(
    saleAmount,
    multiplier = 1,
    amountPerPoint = DEFAULT_AMOUNT_PER_POINT,
  ) {
    const safeSaleAmount = Number(saleAmount);
    const safeMultiplier = Math.max(1, Math.min(10, Number(multiplier) || 1));
    const safeRatio = Math.max(1, Number(amountPerPoint) || DEFAULT_AMOUNT_PER_POINT);

    if (!Number.isFinite(safeSaleAmount) || safeSaleAmount <= 0) {
      return { points: 0, rawPoints: 0, multiplier: safeMultiplier };
    }

    const rawPoints = Math.floor(safeSaleAmount / safeRatio);
    const points = rawPoints * safeMultiplier;

    return { points, rawPoints, multiplier: safeMultiplier };
  }

  /**
   * Resolves the current tier and next tier based on accumulated points.
   *
   * @param {number} currentPoints - Total points in current period
   * @param {Array<{ name: string, minPoints: number, bonusPercentage: number }>} tiers
   * @returns {{
   *   tier: { name: string, minPoints: number, bonusPercentage: number } | null,
   *   bonusPercentage: number,
   *   nextTier: { name: string, minPoints: number, bonusPercentage: number } | null,
   *   pointsToNextTier: number
   * }}
   */
  static resolveTier(currentPoints, tiers = DEFAULT_TIERS) {
    const safePoints = Number(currentPoints) || 0;

    // Sort tiers by minPoints descending to find the highest qualifying tier
    const sortedTiers = [...(tiers || DEFAULT_TIERS)]
      .filter((t) => t && typeof t.minPoints === "number")
      .sort((a, b) => b.minPoints - a.minPoints);

    if (sortedTiers.length === 0) {
      return {
        tier: null,
        bonusPercentage: 0,
        nextTier: null,
        pointsToNextTier: 0,
      };
    }

    let currentTier = null;
    let nextTier = null;

    // Find the highest tier the employee qualifies for
    for (const tier of sortedTiers) {
      if (safePoints >= tier.minPoints) {
        currentTier = tier;
        break;
      }
    }

    // Find the next tier above current
    const sortedAsc = [...sortedTiers].reverse();
    if (currentTier) {
      const currentIndex = sortedAsc.findIndex(
        (t) => t.minPoints === currentTier.minPoints,
      );
      if (currentIndex >= 0 && currentIndex < sortedAsc.length - 1) {
        nextTier = sortedAsc[currentIndex + 1];
      }
    } else {
      // Not in any tier yet, next tier is the lowest
      nextTier = sortedAsc[0] || null;
    }

    const pointsToNextTier = nextTier
      ? Math.max(0, nextTier.minPoints - safePoints)
      : 0;

    return {
      tier: currentTier || null,
      bonusPercentage: currentTier?.bonusPercentage || 0,
      nextTier: nextTier || null,
      pointsToNextTier,
    };
  }

  /**
   * Determines if the tier bonus should be applied to the employee's commission.
   *
   * LA REGLA DE ORO:
   * If eligibleForGamificationBonus is false, the employee does NOT get the
   * tier bonus percentage, but still accumulates points for ranking.
   *
   * @param {boolean} isEligible - Membership.eligibleForGamificationBonus
   * @param {{ bonusPercentage: number } | null} tier - Resolved tier
   * @returns {number} The bonus percentage to apply (0 if not eligible)
   */
  static getTierBonusIfEligible(isEligible, tier) {
    if (!isEligible || !tier) {
      return 0;
    }

    return Math.max(0, Number(tier.bonusPercentage) || 0);
  }

  /**
   * Computes the next period boundaries based on the cycle duration.
   *
   * @param {string} duration - "weekly" | "biweekly" | "monthly"
   * @param {Date} currentPeriodEnd - End of the current period
   * @returns {{ start: Date, end: Date }}
   */
  static computeNextPeriod(duration, currentPeriodEnd) {
    const start = new Date(currentPeriodEnd);
    start.setMilliseconds(start.getMilliseconds() + 1);

    const end = new Date(start);

    switch (duration) {
      case "weekly":
        end.setDate(end.getDate() + 7);
        break;
      case "biweekly":
        end.setDate(end.getDate() + 15);
        break;
      case "monthly":
        end.setMonth(end.getMonth() + 1);
        break;
      default:
        end.setDate(end.getDate() + 15);
    }

    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Initializes period boundaries for a brand-new config.
   *
   * @param {string} duration - "weekly" | "biweekly" | "monthly"
   * @param {Date} now
   * @returns {{ start: Date, end: Date }}
   */
  static initializePeriod(duration, now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    switch (duration) {
      case "weekly":
        end.setDate(end.getDate() + 7);
        break;
      case "biweekly":
        end.setDate(end.getDate() + 15);
        break;
      case "monthly":
        end.setMonth(end.getMonth() + 1);
        break;
      default:
        end.setDate(end.getDate() + 15);
    }

    end.setHours(23, 59, 59, 999);

    return { start, end };
  }
}

export default GamificationService;
