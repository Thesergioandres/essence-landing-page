/**
 * Analytics Services
 * Extracted from monolithic api/services.ts
 * Handles analytics, audit logs, and reporting
 */

import api from "../../../api/axios";

// ==================== ANALYTICS SERVICE ====================
export const analyticsService = {
  async getMonthlyProfit(filters?: { year?: number; month?: number }): Promise<{
    profit: {
      totalSales: number;
      totalCost: number;
      totalProfit: number;
      salesCount: number;
      averageSaleValue: number;
      averageProfit: number;
    };
    byProduct: Array<{
      productId: string;
      productName: string;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }>;
    byDistributor: Array<{
      distributorId: string;
      distributorName: string;
      salesCount: number;
      revenue: number;
      adminProfit: number;
      distributorProfit: number;
    }>;
  }> {
    const response = await api.get("/analytics/profit/monthly", {
      params: filters,
    });
    return response.data;
  },

  async getProfitByProduct(filters?: {
    startDate?: string;
    endDate?: string;
    productId?: string;
  }): Promise<{
    products: Array<{
      productId: string;
      productName: string;
      productImage?: { url: string; thumbnailUrl?: string };
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      averageProfit: number;
      salesCount: number;
    }>;
    totals: {
      revenue: number;
      cost: number;
      profit: number;
      quantity: number;
    };
  }> {
    const response = await api.get("/analytics/profit/by-product", {
      params: filters,
    });
    return response.data;
  },

  async getProfitByDistributor(filters?: {
    startDate?: string;
    endDate?: string;
    distributorId?: string;
  }): Promise<{
    distributors: Array<{
      distributorId: string;
      distributorName: string;
      totalSales: number;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      adminProfit: number;
      distributorProfit: number;
    }>;
    totals: {
      revenue: number;
      cost: number;
      profit: number;
    };
  }> {
    const response = await api.get("/analytics/profit/by-distributor", {
      params: filters,
    });
    return response.data;
  },

  async getAverages(): Promise<{
    averages: {
      dailySales: number;
      dailyRevenue: number;
      dailyProfit: number;
      weeklySales: number;
      weeklyRevenue: number;
      weeklyProfit: number;
      monthlySales: number;
      monthlyRevenue: number;
      monthlyProfit: number;
    };
    comparisons: {
      vsLastWeek: number;
      vsLastMonth: number;
    };
  }> {
    const response = await api.get("/analytics/averages");
    return response.data;
  },

  async getSalesTimeline(filters?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "hour" | "day" | "week" | "month";
  }): Promise<{
    timeline: Array<{
      date: string;
      salesCount: number;
      revenue: number;
      profit: number;
      quantity: number;
    }>;
    summary: {
      totalSales: number;
      totalRevenue: number;
      totalProfit: number;
      peakDate: string;
      peakSales: number;
    };
  }> {
    const response = await api.get("/analytics/timeline", { params: filters });
    return response.data;
  },

  async getFinancialSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    summary: {
      totalRevenue: number;
      totalCost: number;
      grossProfit: number;
      adminProfit: number;
      distributorProfit: number;
      expenses: number;
      netProfit: number;
      profitMargin: number;
    };
    breakdown: {
      byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
      byCategory: Array<{
        category: string;
        revenue: number;
        profit: number;
        quantity: number;
      }>;
    };
  }> {
    const response = await api.get("/analytics/financial-summary", {
      params: filters,
    });
    return response.data;
  },

  async getAnalyticsDashboard(): Promise<{
    today: {
      sales: number;
      revenue: number;
      profit: number;
      newCustomers: number;
    };
    week: {
      sales: number;
      revenue: number;
      profit: number;
      trend: number;
    };
    month: {
      sales: number;
      revenue: number;
      profit: number;
      trend: number;
    };
    topProducts: Array<{
      productId: string;
      name: string;
      quantity: number;
      revenue: number;
    }>;
    topDistributors: Array<{
      distributorId: string;
      name: string;
      sales: number;
      revenue: number;
    }>;
    alerts: Array<{
      type: "low_stock" | "overdue_credit" | "pending_warranty";
      count: number;
      message: string;
    }>;
  }> {
    const response = await api.get("/analytics/dashboard");
    return response.data;
  },

  async getPaymentMethodMetrics(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    metrics: Array<{
      methodId: string;
      methodName: string;
      count: number;
      total: number;
      percentage: number;
      averageAmount: number;
    }>;
    totals: {
      count: number;
      amount: number;
    };
  }> {
    const response = await api.get("/analytics/payment-methods", {
      params: filters,
    });
    return response.data;
  },

  async getEstimatedProfit(params?: {
    startDate?: string;
    endDate?: string;
    distributorId?: string;
  }): Promise<{
    estimatedProfit: {
      total: number;
      confirmed: number;
      pending: number;
      byProduct: Array<{
        productId: string;
        productName: string;
        quantity: number;
        profit: number;
      }>;
    };
  }> {
    const response = await api.get("/analytics/estimated-profit", { params });
    return response.data;
  },

  async getDistributorEstimatedProfit(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    estimatedProfit: {
      total: number;
      confirmed: number;
      pending: number;
      byProduct: Array<{
        productId: string;
        productName: string;
        quantity: number;
        profit: number;
      }>;
    };
  }> {
    const response = await api.get("/analytics/distributor/estimated-profit", {
      params,
    });
    return response.data;
  },
};

// ==================== ADVANCED ANALYTICS SERVICE ====================
export const advancedAnalyticsService = {
  async getProductPerformance(params?: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    limit?: number;
  }): Promise<{
    products: Array<{
      productId: string;
      name: string;
      category: string;
      salesCount: number;
      revenue: number;
      profit: number;
      growthRate: number;
      stockTurnover: number;
      averageDaysToSell: number;
      profitMargin: number;
      trend: "up" | "down" | "stable";
    }>;
    insights: Array<{
      type: "bestseller" | "underperformer" | "trending" | "declining";
      productId: string;
      message: string;
    }>;
  }> {
    const response = await api.get("/analytics/advanced/product-performance", {
      params,
    });
    return response.data;
  },

  async getDistributorPerformance(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    distributors: Array<{
      distributorId: string;
      name: string;
      salesCount: number;
      revenue: number;
      adminProfit: number;
      averageOrderValue: number;
      customerCount: number;
      retentionRate: number;
      growthRate: number;
      rank: number;
    }>;
    comparison: {
      topPerformer: string;
      averagePerformance: number;
      totalContribution: number;
    };
  }> {
    const response = await api.get(
      "/analytics/advanced/distributor-performance",
      { params }
    );
    return response.data;
  },

  async getCustomerInsights(params?: {
    startDate?: string;
    endDate?: string;
    segmentId?: string;
  }): Promise<{
    overview: {
      totalCustomers: number;
      activeCustomers: number;
      newCustomers: number;
      churnRate: number;
      averageLifetimeValue: number;
    };
    segments: Array<{
      name: string;
      count: number;
      revenue: number;
      averageOrderValue: number;
    }>;
    topCustomers: Array<{
      customerId: string;
      name: string;
      totalSpent: number;
      orderCount: number;
      lastPurchase: Date;
    }>;
    purchasePatterns: {
      peakDays: string[];
      peakHours: number[];
      averageFrequency: number;
    };
  }> {
    const response = await api.get("/analytics/advanced/customer-insights", {
      params,
    });
    return response.data;
  },

  async getForecast(params?: { months?: number }): Promise<{
    forecast: Array<{
      month: string;
      predictedRevenue: number;
      predictedProfit: number;
      predictedSales: number;
      confidence: number;
    }>;
    factors: Array<{
      factor: string;
      impact: "positive" | "negative" | "neutral";
      weight: number;
    }>;
  }> {
    const response = await api.get("/analytics/advanced/forecast", { params });
    return response.data;
  },

  async getCashFlow(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }): Promise<{
    cashFlow: Array<{
      date: string;
      income: number;
      expenses: number;
      net: number;
      balance: number;
    }>;
    summary: {
      totalIncome: number;
      totalExpenses: number;
      netCashFlow: number;
      averageDaily: number;
    };
    pending: {
      receivables: number;
      payables: number;
    };
  }> {
    const response = await api.get("/analytics/advanced/cash-flow", { params });
    return response.data;
  },

  async getInventoryAnalysis(): Promise<{
    overview: {
      totalProducts: number;
      totalValue: number;
      lowStockCount: number;
      outOfStockCount: number;
      overstockCount: number;
    };
    turnover: {
      average: number;
      byCategory: Array<{
        category: string;
        turnover: number;
        daysToSell: number;
      }>;
    };
    recommendations: Array<{
      type: "reorder" | "clearance" | "discontinue";
      productId: string;
      productName: string;
      reason: string;
      suggestedAction: string;
    }>;
    alerts: Array<{
      type: "low_stock" | "expiring" | "slow_moving";
      productId: string;
      productName: string;
      message: string;
      priority: "high" | "medium" | "low";
    }>;
  }> {
    const response = await api.get("/analytics/advanced/inventory");
    return response.data;
  },
};

// ==================== AUDIT SERVICE ====================
export const auditService = {
  async getLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    logs: Array<{
      _id: string;
      user: {
        _id: string;
        name: string;
        email: string;
      };
      action: string;
      resourceType: string;
      resourceId?: string;
      details?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      createdAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    actions: string[];
    resourceTypes: string[];
  }> {
    const response = await api.get("/audit", { params });
    return response.data;
  },

  async getLogById(id: string): Promise<{
    log: {
      _id: string;
      user: {
        _id: string;
        name: string;
        email: string;
      };
      action: string;
      resourceType: string;
      resourceId?: string;
      details?: Record<string, any>;
      previousState?: Record<string, any>;
      newState?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      createdAt: Date;
    };
  }> {
    const response = await api.get(`/audit/${id}`);
    return response.data;
  },

  async getDailySummary(date?: string): Promise<{
    date: string;
    summary: {
      totalActions: number;
      uniqueUsers: number;
      byAction: Array<{ action: string; count: number }>;
      byResourceType: Array<{ type: string; count: number }>;
      byUser: Array<{ userId: string; userName: string; count: number }>;
    };
  }> {
    const response = await api.get("/audit/summary/daily", {
      params: { date },
    });
    return response.data;
  },

  async getStats(): Promise<{
    stats: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      total: number;
    };
    recentActivity: Array<{
      _id: string;
      action: string;
      user: string;
      createdAt: Date;
    }>;
  }> {
    const response = await api.get("/audit/stats");
    return response.data;
  },
};
