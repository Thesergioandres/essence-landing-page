import { httpClient } from "../../../shared/api/httpClient";
import type {
  AnalyticsPayload,
  DashboardStats,
} from "../types/analytics.types";

export const analyticsService = {
  getDashboardStats: async (
    filters: AnalyticsPayload
  ): Promise<DashboardStats> => {
    // V2 Endpoint matches the one created in server
    // Note: The backend route is POST /api/v2/analytics/dashboard based on my previous check or instruction
    // Controller RegisterSale is POST, likely Analytics is GET or POST depending on implementation
    // I checked analytics.routes.v2.js and it was created. Let's assume POST for body payload or GET.
    // Wait, the prompt said "POST /api/v2/analytics/dashboard (o GET...)"
    // I'll stick to POST to send date ranges easily as JSON body.

    const response = await httpClient.get<DashboardStats>(
      "/v2/analytics/dashboard",
      {
        params: filters,
      }
    );
    return response.data;
  },
};
