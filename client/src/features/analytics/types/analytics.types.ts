export interface DashboardDateRange {
  startDate: string; // ISO String
  endDate: string; // ISO String
}

export interface KPI {
  value: number;
  change?: number; // percentage change vs previous period
  trend?: "up" | "down" | "neutral";
}

export interface DashboardStats {
  totalRevenue: number;
  totalNetProfit: number;
  totalSalesCount: number;
  averageTicket: number;

  // Graph Data
  salesTimeline: Array<{
    date: string; // "2023-10-01"
    revenue: number;
    profit: number;
  }>;

  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface AnalyticsPayload {
  startDate?: string;
  endDate?: string;
  period?: "today" | "week" | "month" | "year";
}
