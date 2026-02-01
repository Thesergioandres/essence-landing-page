import { httpClient } from "../../../shared/api/httpClient";
import type {
  AnalyticsPayload,
  DashboardStats,
} from "../types/analytics.types";

export const analyticsService = {
  getDashboardStats: async (
    filters: AnalyticsPayload
  ): Promise<DashboardStats> => {
    const response = await httpClient.get<{
      success: boolean;
      data: DashboardStats;
    }>("/v2/analytics/dashboard", {
      params: filters,
    });
    return response.data.data; // Backend wraps in { success, data }
  },
};
