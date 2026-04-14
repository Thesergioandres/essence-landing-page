/**
 * Analytics Services
 * Extracted from monolithic api/services.ts
 * Handles analytics, audit logs, and reporting
 */

import api from "../../../api/axios";

// ==================== ANALYTICS SERVICE ====================
export const analyticsService = {
  /**
   * Get monthly profit data using V2 financial-kpis endpoint
   * Maps backend response to frontend expected format
   */
  async getMonthlyProfit(filters?: {
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    currentMonth: {
      revenue: number;
      totalProfit: number;
      totalOPEX: number;
      netOperationProfit: number;
      salesCount: number;
    };
    lastMonth: {
      revenue: number;
      totalProfit: number;
      salesCount: number;
    };
    growthPercentage: number;
    averageTicket: number;
    accountsReceivable?: number;
  }> {
    try {
      // Use V2 financial-kpis endpoint
      const response = await api.get("/advanced-analytics/financial-kpis", {
        params: {
          startDate: filters?.startDate,
          endDate: filters?.endDate,
        },
      });

      const data = response.data.data || response.data;
      const range = data?.range || {};
      const monthly = data?.monthly || {};
      const kpis = data?.kpis || {};

      // Map to frontend expected format
      return {
        currentMonth: {
          revenue: range.revenue || monthly.revenue || 0,
          totalProfit: range.grossProfit || monthly.profit || 0,
          totalOPEX: range.totalExpenses || kpis.totalExpenses || 0,
          netOperationProfit:
            range.netProfit ||
            (range.grossProfit || 0) - (range.totalExpenses || 0),
          salesCount: range.sales || monthly.sales || kpis.monthSales || 0,
        },
        lastMonth: {
          revenue: 0, // Would need separate call for previous period
          totalProfit: 0,
          salesCount: 0,
        },
        growthPercentage: 0,
        averageTicket: range.avgTicket || 0,
        accountsReceivable: 0, // Would need credits endpoint
      };
    } catch (error) {
      console.error("[getMonthlyProfit] Error:", error);
      // Return empty data on error
      return {
        currentMonth: {
          revenue: 0,
          totalProfit: 0,
          totalOPEX: 0,
          netOperationProfit: 0,
          salesCount: 0,
        },
        lastMonth: { revenue: 0, totalProfit: 0, salesCount: 0 },
        growthPercentage: 0,
        averageTicket: 0,
      };
    }
  },

  /**
   * Get profit by product using V2 top-products endpoint
   */
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
      totalSales?: number;
    }>;
    totals: {
      revenue: number;
      cost: number;
      profit: number;
      quantity: number;
    };
  }> {
    try {
      const response = await api.get("/advanced-analytics/top-products", {
        params: { ...filters, limit: 50 },
      });
      const rawData = response.data.data || response.data || [];
      const data = Array.isArray(rawData) ? rawData : [];

      const products = data.map((item: any) => ({
        productId: item._id || item.productId,
        productName: item.product?.name || item.name || "Sin nombre",
        productImage: item.product?.image,
        totalQuantity: item.totalQuantity || 0,
        totalRevenue: item.totalRevenue || 0,
        totalCost: 0, // Not provided by backend
        totalProfit: item.totalProfit || 0,
        averageProfit:
          item.totalQuantity > 0
            ? (item.totalProfit || 0) / item.totalQuantity
            : 0,
        salesCount: item.salesCount || item.totalQuantity || 0,
        totalSales: item.salesCount || item.totalQuantity || 0,
      }));

      const totals = products.reduce(
        (acc: any, p: any) => ({
          revenue: acc.revenue + p.totalRevenue,
          cost: acc.cost + p.totalCost,
          profit: acc.profit + p.totalProfit,
          quantity: acc.quantity + p.totalQuantity,
        }),
        { revenue: 0, cost: 0, profit: 0, quantity: 0 }
      );

      return { products, totals };
    } catch (error) {
      console.error("[getProfitByProduct] Error:", error);
      return {
        products: [],
        totals: { revenue: 0, cost: 0, profit: 0, quantity: 0 },
      };
    }
  },

  /**
   * Get profit by employee using V2 employee-performance endpoint
   */
  async getProfitByEmployee(filters?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
  }): Promise<{
    employees: Array<{
      employeeId: string;
      employeeName: string;
      totalSales: number;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      adminProfit: number;
      employeeProfit: number;
    }>;
    totals: {
      revenue: number;
      cost: number;
      profit: number;
    };
  }> {
    try {
      const response = await api.get(
        "/advanced-analytics/employee-performance",
        {
          params: filters,
        }
      );
      const rawData = response.data.data || response.data || [];
      const data = Array.isArray(rawData) ? rawData : [];

      const employees = data.map((item: any) => ({
        employeeId: item._id || item.employeeId,
        employeeName:
          item.employee?.name || item.employeeName || "Sin nombre",
        totalSales: item.totalSales || 0,
        totalRevenue: item.totalRevenue || 0,
        totalCost: 0,
        totalProfit: item.totalProfit || 0,
        adminProfit: item.totalProfit - (item.employeeProfit || 0),
        employeeProfit: item.employeeProfit || 0,
      }));

      const totals = employees.reduce(
        (acc: any, d: any) => ({
          revenue: acc.revenue + d.totalRevenue,
          cost: acc.cost + d.totalCost,
          profit: acc.profit + d.totalProfit,
        }),
        { revenue: 0, cost: 0, profit: 0 }
      );

      return { employees, totals };
    } catch (error) {
      console.error("[getProfitByEmployee] Error:", error);
      return { employees: [], totals: { revenue: 0, cost: 0, profit: 0 } };
    }
  },

  /**
   * Get averages using V2 financial-kpis endpoint
   */
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
    try {
      const response = await api.get("/advanced-analytics/financial-kpis");
      const data = response.data.data || response.data;
      const kpis = data?.kpis || {};
      const daily = data?.daily || {};
      const weekly = data?.weekly || {};
      const monthly = data?.monthly || {};

      return {
        averages: {
          dailySales: daily.sales || kpis.todaySales || 0,
          dailyRevenue: daily.revenue || kpis.todayRevenue || 0,
          dailyProfit:
            daily.netProfit ||
            kpis.todayNetProfit ||
            daily.profit ||
            kpis.todayProfit ||
            0,
          weeklySales: weekly.sales || kpis.weekSales || 0,
          weeklyRevenue: weekly.revenue || kpis.weekRevenue || 0,
          weeklyProfit:
            weekly.netProfit ||
            kpis.weekNetProfit ||
            weekly.profit ||
            kpis.weekProfit ||
            0,
          monthlySales: monthly.sales || kpis.monthSales || 0,
          monthlyRevenue: monthly.revenue || kpis.monthRevenue || 0,
          monthlyProfit:
            monthly.netProfit ||
            kpis.monthNetProfit ||
            monthly.profit ||
            kpis.monthProfit ||
            0,
        },
        comparisons: {
          vsLastWeek: 0,
          vsLastMonth: 0,
        },
      };
    } catch (error) {
      console.error("[getAverages] Error:", error);
      return {
        averages: {
          dailySales: 0,
          dailyRevenue: 0,
          dailyProfit: 0,
          weeklySales: 0,
          weeklyRevenue: 0,
          weeklyProfit: 0,
          monthlySales: 0,
          monthlyRevenue: 0,
          monthlyProfit: 0,
        },
        comparisons: { vsLastWeek: 0, vsLastMonth: 0 },
      };
    }
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
    // Use V2 advanced-analytics endpoint
    const response = await api.get("/advanced-analytics/sales-timeline", {
      params: filters,
    });
    const data = response.data.data || response.data;
    return {
      timeline: data?.timeline || [],
      summary: data?.summary || {
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        peakDate: "",
        peakSales: 0,
      },
    };
  },

  /**
   * Get financial summary using V2 financial-kpis + sales-summary
   */
  async getFinancialSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    summary: {
      totalRevenue: number;
      totalCost: number;
      grossProfit: number;
      adminProfit: number;
      employeeProfit: number;
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
    try {
      // Use V2 financial-kpis + sales-by-category endpoints
      const [kpisRes, categoryRes, expensesRes] = await Promise.all([
        api.get("/advanced-analytics/financial-kpis", { params: filters }),
        api.get("/advanced-analytics/sales-by-category", { params: filters }),
        api.get("/advanced-analytics/expenses-summary", { params: filters }),
      ]);

      const kpis = kpisRes.data.data || kpisRes.data;
      const range = kpis?.range || {};
      const categories = categoryRes.data.data || categoryRes.data || [];
      const expenses = expensesRes.data.data || expensesRes.data || {};

      const totalExpenses = expenses.totalAmount || range.totalExpenses || 0;
      const grossProfit = range.grossProfit || 0;
      const netProfit = grossProfit - totalExpenses;

      return {
        summary: {
          totalRevenue: range.revenue || 0,
          totalCost: 0, // Not directly available
          grossProfit,
          adminProfit: grossProfit, // Simplified
          employeeProfit: 0,
          expenses: totalExpenses,
          netProfit,
          profitMargin:
            range.revenue > 0 ? (netProfit / range.revenue) * 100 : 0,
        },
        breakdown: {
          byPaymentMethod: [], // Would need separate endpoint
          byCategory: Array.isArray(categories)
            ? categories.map((c: any) => ({
                category: c.category || c.categoryName || "Sin categoría",
                revenue: c.revenue || c.totalRevenue || 0,
                profit: c.profit || c.totalProfit || 0,
                quantity: c.quantity || c.totalQuantity || 0,
              }))
            : [],
        },
      };
    } catch (error) {
      console.error("[getFinancialSummary] Error:", error);
      return {
        summary: {
          totalRevenue: 0,
          totalCost: 0,
          grossProfit: 0,
          adminProfit: 0,
          employeeProfit: 0,
          expenses: 0,
          netProfit: 0,
          profitMargin: 0,
        },
        breakdown: { byPaymentMethod: [], byCategory: [] },
      };
    }
  },

  /**
   * Get analytics dashboard using V2 endpoint
   */
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
    topEmployees: Array<{
      employeeId: string;
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
    try {
      const response = await api.get("/analytics/dashboard");
      const data = response.data.data || response.data;

      return {
        today: data?.today || {
          sales: 0,
          revenue: 0,
          profit: 0,
          newCustomers: 0,
        },
        week: data?.week || { sales: 0, revenue: 0, profit: 0, trend: 0 },
        month: data?.month || { sales: 0, revenue: 0, profit: 0, trend: 0 },
        topProducts: data?.topProducts || [],
        topEmployees: data?.topEmployees || [],
        alerts: data?.alerts || [],
      };
    } catch (error) {
      console.error("[getAnalyticsDashboard] Error:", error);
      return {
        today: { sales: 0, revenue: 0, profit: 0, newCustomers: 0 },
        week: { sales: 0, revenue: 0, profit: 0, trend: 0 },
        month: { sales: 0, revenue: 0, profit: 0, trend: 0 },
        topProducts: [],
        topEmployees: [],
        alerts: [],
      };
    }
  },

  /**
   * Get payment method metrics
   * NOTE: This endpoint doesn't exist in V2 - returning empty data
   * TODO: Create backend endpoint or remove from frontend
   */
  async getPaymentMethodMetrics(_filters?: {
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
    void _filters;
    console.warn("[getPaymentMethodMetrics] Endpoint not implemented in V2");
    return {
      metrics: [],
      totals: { count: 0, amount: 0 },
    };
  },

  async getEstimatedProfit(params?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
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
    // Handle V2 response format: { success, data: {...} }
    const rawData = response.data?.data || response.data;
    return {
      estimatedProfit: rawData?.estimatedProfit || rawData || {},
      ...rawData,
    };
  },

  async getEmployeeEstimatedProfit(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    estimatedProfit: {
      grossProfit: number;
      netProfit: number;
      totalProducts: number;
      totalUnits: number;
      investment: number;
      salesValue: number;
      profitMargin: string;
      profitability: number;
      products: Array<{
        productId: string;
        name: string;
        image?: { url: string; publicId: string };
        quantity: number;
        employeePrice: number;
        clientPrice: number;
        investment: number;
        salesValue: number;
        estimatedProfit: number;
        profitPercentage: string;
      }>;
    };
  }> {
    const response = await api.get("/analytics/staff/estimated-profit", {
      params,
    });
    // V2 response: { success: true, data: { grossProfit, products, ... } }
    const data = response.data?.data || response.data;
    return {
      estimatedProfit: data,
    };
  },

  /**
   * Export full business data as JSON backup
   * Returns all collections related to the business
   */
  async getFullDataExport(): Promise<any> {
    const response = await api.get("/business/export-full-data");
    // V2 API returns { success: true, data: {...} }
    return response.data.data || response.data;
  },
};

// ==================== ADVANCED ANALYTICS SERVICE ====================
const isForbiddenError = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status === 403;

export const advancedAnalyticsService = {
  // ===== Sales & Revenue Analytics =====
  async getSalesTimeline(params?: {
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
    try {
      const response = await api.get("/advanced-analytics/sales-timeline", {
        params,
      });
      const data = response.data.data || response.data;
      return {
        timeline: data?.timeline || [],
        summary: data?.summary || {
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          peakDate: "",
          peakSales: 0,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return {
          timeline: [],
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            totalProfit: 0,
            peakDate: "",
            peakSales: 0,
          },
        };
      }
      throw error;
    }
  },

  async getSalesByCategory(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    categories: Array<{
      category: string;
      sales: number;
      revenue: number;
      profit: number;
      quantity: number;
    }>;
  }> {
    try {
      const response = await api.get("/advanced-analytics/sales-by-category", {
        params,
      });
      console.log("[getSalesByCategory] response.data:", response.data);
      const rawData = response.data.data || response.data || [];
      console.log("[getSalesByCategory] rawData:", rawData);
      const data = Array.isArray(rawData) ? rawData : [];

      const categories = data.map((item: any) => {
        const transformed = {
          name: item.category || "Sin categoría",
          category: item.category || "Sin categoría",
          totalSales: item.sales || 0,
          sales: item.sales || 0,
          totalRevenue: item.revenue || 0,
          revenue: item.revenue || 0,
          profit: item.profit || 0,
          quantity: item.quantity || 0,
        };
        console.log(
          "[getSalesByCategory] item:",
          item,
          "-> transformed:",
          transformed
        );
        return transformed;
      });

      console.log(
        "[getSalesByCategory] categories after transform:",
        categories
      );
      return { categories };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { categories: [] };
      }
      throw error;
    }
  },

  async getSalesFunnel(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    funnel: Array<{
      stage: string;
      count: number;
      value: number;
      conversionRate: number;
    }>;
    summary: {
      totalLeads: number;
      totalConversions: number;
      overallConversionRate: number;
    };
  }> {
    try {
      const response = await api.get("/advanced-analytics/sales-funnel", {
        params,
      });
      return response.data.data;
    } catch (error) {
      if (isForbiddenError(error)) {
        return {
          funnel: [],
          summary: {
            totalLeads: 0,
            totalConversions: 0,
            overallConversionRate: 0,
          },
        };
      }
      throw error;
    }
  },

  // ===== Product Analytics =====
  async getTopProducts(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    sortBy?: "revenue" | "quantity" | "profit";
  }): Promise<{
    topProducts: Array<{
      productId: string;
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      profit: number;
      rank: number;
    }>;
  }> {
    try {
      const response = await api.get("/advanced-analytics/top-products", {
        params,
      });
      console.log("[getTopProducts] response.data:", response.data);
      const rawData = response.data.data || response.data || [];
      console.log("[getTopProducts] rawData:", rawData);
      const data = Array.isArray(rawData) ? rawData : [];
      console.log("[getTopProducts] data after isArray check:", data);

      const topProducts = data.map((item: any, index: number) => {
        const transformed = {
          productId: item._id || item.productId,
          name: item.product?.name || item.name || "Sin nombre",
          category:
            item.product?.category?.name ||
            item.product?.category ||
            item.category ||
            "Sin categoría",
          quantity: item.totalQuantity || 0,
          revenue: item.totalRevenue || 0,
          rank: index + 1,
          profit: item.totalProfit || 0,
        };
        console.log(
          "[getTopProducts] item:",
          item,
          "-> transformed:",
          transformed
        );
        return transformed;
      });

      console.log("[getTopProducts] topProducts after transform:", topProducts);
      return { topProducts };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { topProducts: [] };
      }
      throw error;
    }
  },

  async getProductRotation(params?: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    days?: number;
  }): Promise<{
    productRotation: Array<{
      _id: string;
      name: string;
      totalSold: number;
      frequency: number;
      currentStock: number;
      rotationRate: number;
    }>;
  }> {
    try {
      const response = await api.get("/advanced-analytics/product-rotation", {
        params,
      });
      console.log("[getProductRotation] response.data:", response.data);
      const rawData = response.data.data || response.data || [];
      console.log("[getProductRotation] rawData:", rawData);
      const data = Array.isArray(rawData) ? rawData : [];

      const productRotation = data.map((item: any) => ({
        _id: item.productId || item._id,
        name: item.productName || item.name || "Sin nombre",
        totalSold: item.totalQuantity || 0,
        frequency: item.salesCount || 0,
        currentStock: 0,
        rotationRate: item.rotationRate || 0,
      }));

      console.log(
        "[getProductRotation] productRotation after transform:",
        productRotation
      );
      return { productRotation };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { productRotation: [] };
      }
      throw error;
    }
  },

  /**
   * Get product performance
   * NOTE: This specific endpoint doesn't exist in V2 - using top-products instead
   */
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
    try {
      const response = await api.get("/advanced-analytics/top-products", {
        params: { ...params, limit: params?.limit || 20 },
      });
      const rawData = response.data.data || response.data || [];
      const data = Array.isArray(rawData) ? rawData : [];

      const products = data.map((item: any) => ({
        productId: item._id || item.productId,
        name: item.product?.name || item.name || "Sin nombre",
        category: item.product?.category?.name || "Sin categoría",
        salesCount: item.totalQuantity || 0,
        revenue: item.totalRevenue || 0,
        profit: item.totalProfit || 0,
        growthRate: 0, // Not available
        stockTurnover: 0,
        averageDaysToSell: 0,
        profitMargin:
          item.totalRevenue > 0
            ? ((item.totalProfit || 0) / item.totalRevenue) * 100
            : 0,
        trend: "stable" as const,
      }));

      return { products, insights: [] };
    } catch (error) {
      console.error("[getProductPerformance] Error:", error);
      return { products: [], insights: [] };
    }
  },

  async getEmployeePerformance(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    employees: Array<{
      employeeId: string;
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
      "/advanced-analytics/employee-performance",
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
    void params;
    console.warn("[getCustomerInsights] Endpoint not implemented in V2");
    return {
      overview: {
        totalCustomers: 0,
        activeCustomers: 0,
        newCustomers: 0,
        churnRate: 0,
        averageLifetimeValue: 0,
      },
      segments: [],
      topCustomers: [],
      purchasePatterns: { peakDays: [], peakHours: [], averageFrequency: 0 },
    };
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
    void params;
    console.warn("[getForecast] Endpoint not implemented in V2");
    return { forecast: [], factors: [] };
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
    void params;
    console.warn("[getCashFlow] Endpoint not implemented in V2");
    return {
      cashFlow: [],
      summary: {
        totalIncome: 0,
        totalExpenses: 0,
        netCashFlow: 0,
        averageDaily: 0,
      },
      pending: { receivables: 0, payables: 0 },
    };
  },

  /**
   * Get inventory analysis using V2 inventory-status endpoint
   */
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
    try {
      const response = await api.get("/advanced-analytics/inventory-status");
      const data = response.data.data || response.data;
      return {
        overview: {
          totalProducts: data.totalProducts || 0,
          totalValue: data.totalInventoryValue || 0,
          lowStockCount: data.lowStockProducts || 0,
          outOfStockCount: 0,
          overstockCount: 0,
        },
        turnover: { average: 0, byCategory: [] },
        recommendations: [],
        alerts: [],
      };
    } catch (error) {
      console.error("[getInventoryAnalysis] Error:", error);
      return {
        overview: {
          totalProducts: 0,
          totalValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          overstockCount: 0,
        },
        turnover: { average: 0, byCategory: [] },
        recommendations: [],
        alerts: [],
      };
    }
  },

  // ===== Financial & KPI Analytics =====
  async getFinancialKPIs(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    kpis: {
      revenue: number;
      profit: number;
      profitMargin: number;
      averageOrderValue: number;
      ordersCount: number;
      customersCount: number;
      returnRate: number;
    };
    trends: {
      revenueTrend: number;
      profitTrend: number;
      ordersTrend: number;
    };
    comparison: {
      vsPreviousPeriod: {
        revenue: number;
        profit: number;
        orders: number;
      };
    };
  }> {
    try {
      const response = await api.get("/advanced-analytics/financial-kpis", {
        params,
      });
      return response.data.data;
    } catch (error) {
      if (isForbiddenError(error)) {
        return {
          kpis: {
            revenue: 0,
            profit: 0,
            profitMargin: 0,
            averageOrderValue: 0,
            ordersCount: 0,
            customersCount: 0,
            returnRate: 0,
          },
          trends: {
            revenueTrend: 0,
            profitTrend: 0,
            ordersTrend: 0,
          },
          comparison: {
            vsPreviousPeriod: {
              revenue: 0,
              profit: 0,
              orders: 0,
            },
          },
        };
      }
      throw error;
    }
  },

  async getComparativeAnalysis(): Promise<{
    periods: Array<{
      period: string;
      revenue: number;
      profit: number;
      orders: number;
      customers: number;
    }>;
    comparisons: {
      weekOverWeek: {
        revenue: number;
        profit: number;
        orders: number;
      };
      monthOverMonth: {
        revenue: number;
        profit: number;
        orders: number;
      };
      yearOverYear: {
        revenue: number;
        profit: number;
        orders: number;
      };
    };
  }> {
    try {
      const response = await api.get("/advanced-analytics/comparative");
      return response.data.data;
    } catch (error) {
      if (isForbiddenError(error)) {
        return {
          periods: [],
          comparison: {
            currentMonth: {
              sales: 0,
              revenue: 0,
              profit: 0,
            },
            previousMonth: {
              sales: 0,
              revenue: 0,
              profit: 0,
            },
            growth: {
              salesGrowth: 0,
              revenueGrowth: 0,
              profitGrowth: 0,
            },
          },
          comparisons: {
            currentMonth: {
              sales: 0,
              revenue: 0,
              profit: 0,
            },
            previousMonth: {
              sales: 0,
              revenue: 0,
              profit: 0,
            },
            growth: {
              salesGrowth: 0,
              revenueGrowth: 0,
              profitGrowth: 0,
            },
          },
        } as any;
      }
      throw error;
    }
  },

  // ===== Employee Analytics =====
  async getEmployeeRankings(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    sortBy?: "revenue" | "profit" | "sales";
  }): Promise<{
    rankings: Array<{
      rank: number;
      employeeId: string;
      employeeName: string;
      employeeEmail?: string;
      totalSales: number;
      revenue: number;
      profit: number;
      conversionRate: number;
      averageOrderValue: number;
      change: number;
    }>;
    period: {
      startDate: string;
      endDate: string;
    };
  }> {
    try {
      const response = await api.get(
        "/advanced-analytics/employee-rankings",
        {
          params,
        }
      );
      const payload =
        response.data?.data ?? response.data?.rankings ?? response.data;
      const rawRankings = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.rankings)
          ? payload.rankings
          : [];

      const rankings = rawRankings.map((item: any, index: number) => {
        const totalSales = Number(
          item.totalSales ?? item.salesCount ?? item.sales ?? 0
        );
        const totalRevenue = Number(item.totalRevenue ?? item.revenue ?? 0);
        const totalProfit = Number(item.totalProfit ?? item.profit ?? 0);
        const averageOrderValue =
          totalSales > 0 ? totalRevenue / totalSales : 0;
        const conversionRate = Number(item.conversionRate ?? 0);

        return {
          rank: index + 1,
          employeeId: item.employeeId || item._id,
          employeeName: item.employeeName || item.name || "Sin nombre",
          employeeEmail: item.employeeEmail || item.email || "",
          totalSales,
          revenue: totalRevenue,
          profit: totalProfit,
          conversionRate,
          averageOrderValue: Number(
            item.avgOrderValue ?? item.averageOrderValue ?? averageOrderValue
          ),
          change: Number(item.change ?? 0) || 0,
        };
      });

      const period = response.data?.period ||
        response.data?.data?.period || {
          startDate: params?.startDate || "",
          endDate: params?.endDate || "",
        };

      return { rankings, period };
    } catch (error) {
      if (isForbiddenError(error)) {
        return {
          rankings: [],
          period: {
            startDate: params?.startDate || "",
            endDate: params?.endDate || "",
          },
        };
      }
      throw error;
    }
  },

  // ===== Inventory Visual Analytics =====
  async getLowStockVisual(): Promise<{
    alerts: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      minStock: number;
      daysUntilStockout: number;
      priority: "critical" | "high" | "medium" | "low";
    }>;
    summary: {
      criticalCount: number;
      warningCount: number;
      totalAlerts: number;
    };
  }> {
    try {
      const response = await api.get("/advanced-analytics/low-stock-visual");
      return response.data;
    } catch (error) {
      if (isForbiddenError(error)) {
        return {
          alerts: [],
          lowStockProducts: [],
          summary: {
            criticalCount: 0,
            warningCount: 0,
            totalAlerts: 0,
          },
        } as any;
      }
      throw error;
    }
  },
};

// ==================== AUDIT SERVICE ====================
export const auditService = {
  mapStatsToRecord(entries?: Array<{ _id?: string; count?: number }>) {
    return (entries || []).reduce((acc: Record<string, number>, item) => {
      if (item?._id) {
        acc[item._id] = item.count || 0;
      }
      return acc;
    }, {});
  },
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
    const response = await api.get("/audit/logs", { params });
    const payload = response.data?.data ? response.data : response.data || {};
    const pagination = payload.pagination || {
      page: params?.page || 1,
      limit: params?.limit || 50,
      total: 0,
      pages: 1,
    };
    return {
      logs: payload.data || payload.logs || [],
      pagination: {
        ...pagination,
        currentPage: pagination.page || params?.page || 1,
        totalPages: pagination.pages || 1,
        totalLogs: pagination.total || 0,
      },
      actions: payload.actions || [],
      resourceTypes: payload.resourceTypes || [],
    };
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
    const response = await api.get(`/audit/logs/${id}`);
    const payload = response.data?.data ?? response.data;
    return {
      log: payload,
    } as any;
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
    const payload = response.data?.data ?? response.data;
    return payload || {};
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
    const payload = response.data?.data ?? response.data;
    const statsPayload = payload?.stats || payload || {};
    return {
      stats: {
        actionStats: this.mapStatsToRecord(statsPayload.actionStats),
        moduleStats: this.mapStatsToRecord(statsPayload.moduleStats),
        severityStats: this.mapStatsToRecord(statsPayload.severityStats),
        userStats: statsPayload.userStats || [],
      },
      recentActivity: payload?.recentActivity || [],
    } as any;
  },
};
