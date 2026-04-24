/**
 * Gamification API Service
 * Handles all gamification-related API calls.
 */

import api from "../../../api/axios";
import { isContextReady } from "../../../shared/utils/contextGuard";
import type {
  GamificationConfig,
  MyPointsData,
  PeriodWinnerEntry,
  RankingData,
} from "../types/gamification.types";

export const gamificationService = {
  /** Get gamification config for current business */
  async getConfig(): Promise<GamificationConfig> {
    if (!isContextReady())
      return {
        enabled: false,
        pointsRatio: { amountPerPoint: 1000, currency: "COP" },
        cycle: {
          duration: "biweekly",
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
        tiers: [],
        productMultipliers: [],
      };

    const response = await api.get("/gamification/config");
    return response.data?.data || response.data;
  },

  /** Update gamification config */
  async updateConfig(
    config: Partial<GamificationConfig>,
  ): Promise<GamificationConfig> {
    const response = await api.put("/gamification/config", config);
    return response.data?.data || response.data;
  },

  /** Get current ranking */
  async getRanking(limit = 20): Promise<RankingData> {
    if (!isContextReady())
      return { enabled: false, ranking: [], period: null, tiers: [] };

    const response = await api.get("/gamification/ranking", {
      params: { limit },
    });
    return response.data?.data || response.data;
  },

  /** Get current user's points and progress */
  async getMyPoints(): Promise<MyPointsData> {
    if (!isContextReady())
      return {
        enabled: false,
        currentPoints: 0,
        tier: null,
        nextTier: null,
        pointsToNextTier: 0,
        bonusPercentage: 0,
        isEligibleForBonus: false,
        rankPosition: 0,
        recentHistory: [],
        period: { start: null, end: null, duration: "biweekly" },
      };

    const response = await api.get("/gamification/my-points");
    return response.data?.data || response.data;
  },

  /** Get period winners history (admin) */
  async getPeriodHistory(
    page = 1,
    limit = 10,
  ): Promise<{
    winners: PeriodWinnerEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    if (!isContextReady())
      return {
        winners: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      };

    const response = await api.get("/gamification/history", {
      params: { page, limit },
    });
    return response.data?.data || response.data;
  },

  /** Force period consolidation (super_admin only) */
  async forceConsolidate(): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/gamification/consolidate", {
      manual: true,
    });
    return response.data;
  },
};
