import { useCallback, useEffect, useState } from "react";
import { analyticsService } from "../api/analytics.service";
import type {
  AnalyticsPayload,
  DashboardStats,
} from "../types/analytics.types";

const DEFAULT_STATS: DashboardStats = {
  totalRevenue: 0,
  totalNetProfit: 0,
  totalSalesCount: 0,
  averageTicket: 0,
  salesTimeline: [],
  topProducts: [],
};

export const useDashboardStats = (initialFilters?: AnalyticsPayload) => {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AnalyticsPayload>(
    initialFilters || { period: "month" }
  );

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsService.getDashboardStats(filters);
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Error cargando estadísticas");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    filters,
    setFilters,
    refresh: loadStats,
  };
};
