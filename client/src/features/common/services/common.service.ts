/**
 * Common/Utility Services
 * Extracted from monolithic api/services.ts
 * Handles uploads, issues, user access (god panel), gamification
 */

import api from "../../../api/axios";
import type {
  Achievement,
  Expense,
  GamificationConfig,
  PeriodWinner,
  ProductImage,
  User,
} from "../../../types";

// Types for services
interface DurationPayload {
  months?: number;
  days?: number;
}

interface GodMetricsResponse {
  success: boolean;
  data: {
    totalUsers: number;
    activeUsers: number;
    newThisMonth: number;
    expiringThisWeek: number;
    revenueMRR: number;
  };
}

interface SubscriptionsSummaryResponse {
  success: boolean;
  data: {
    byPlan: Array<{ plan: string; count: number; revenue: number }>;
    byStatus: Array<{ status: string; count: number }>;
  };
}

interface IssueReport {
  _id: string;
  message: string;
  stackTrace?: string;
  logs?: string[];
  clientContext?: {
    url?: string;
    userAgent?: string;
    appVersion?: string;
    businessId?: string | null;
  };
  screenshotUrl?: string;
  screenshotPublicId?: string;
  status: "open" | "reviewing" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

interface RankingResponse {
  success: boolean;
  ranking: Array<{
    distributorId: string;
    distributorName: string;
    totalSales: number;
    totalRevenue: number;
    salesCount: number;
    position: number;
    previousPosition?: number;
    trend?: "up" | "down" | "same";
  }>;
  period: {
    start: string;
    end: string;
  };
}

interface WinnersResponse {
  success: boolean;
  winners: PeriodWinner[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface DistributorStatsResponse {
  success: boolean;
  stats: {
    currentPosition: number;
    bestPosition: number;
    totalWins: number;
    totalBonusEarned: number;
    currentPeriodSales: number;
    averagePosition: number;
  };
}

// ==================== UPLOAD SERVICE ====================
export const uploadService = {
  async uploadImage(file: File): Promise<ProductImage> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await api.post<ProductImage>("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  async deleteImage(publicId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/upload/${publicId}`
    );
    return response.data;
  },
};

// ==================== ISSUE SERVICE ====================
export const issueService = {
  async create(payload: {
    message: string;
    stackTrace?: string;
    logs?: string[];
    clientContext?: {
      url?: string;
      userAgent?: string;
      appVersion?: string;
      businessId?: string | null;
    };
    screenshotUrl?: string;
    screenshotPublicId?: string;
  }): Promise<{ report: IssueReport }> {
    const response = await api.post<{ report: IssueReport }>(
      "/issues",
      payload
    );
    return response.data;
  },

  async list(params?: {
    status?: "open" | "reviewing" | "closed";
    page?: number;
    limit?: number;
  }): Promise<{
    data: IssueReport[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get<{
      data: IssueReport[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>("/issues", { params });
    return response.data;
  },

  async updateStatus(
    id: string,
    status: "open" | "reviewing" | "closed"
  ): Promise<{ report: IssueReport }> {
    const response = await api.patch<{ report: IssueReport }>(`/issues/${id}`, {
      status,
    });
    return response.data;
  },
};

// ==================== USER ACCESS SERVICE (GOD PANEL) ====================
export const userAccessService = {
  async list(): Promise<User[]> {
    const response = await api.get<{ success: boolean; data: User[] }>(
      "/v2/god/users"
    );
    return response.data.data || [];
  },

  async activate(id: string, duration?: DurationPayload): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/v2/god/users/${id}/activate`,
      duration || {}
    );
    return response.data.user;
  },

  async suspend(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/v2/god/users/${id}/suspend`
    );
    return response.data.user;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/v2/god/users/${id}`);
  },

  async extend(id: string, duration?: DurationPayload): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/v2/god/users/${id}/extend`,
      duration || {}
    );
    return response.data.user;
  },

  async pause(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/v2/god/users/${id}/pause`
    );
    return response.data.user;
  },

  async resume(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/v2/god/users/${id}/resume`
    );
    return response.data.user;
  },

  async getGlobalMetrics(): Promise<GodMetricsResponse> {
    const response = await api.get<GodMetricsResponse>("/v2/god/metrics");
    return response.data;
  },

  async getSubscriptionsSummary(): Promise<SubscriptionsSummaryResponse> {
    const response = await api.get<SubscriptionsSummaryResponse>(
      "/v2/god/subscriptions"
    );
    return response.data;
  },
};

// ==================== GAMIFICATION SERVICE ====================
export const gamificationService = {
  async getConfig(): Promise<GamificationConfig> {
    const response = await api.get<GamificationConfig>("/gamification/config");
    return response.data;
  },

  async updateConfig(
    config: Partial<GamificationConfig>
  ): Promise<{ message: string; config: GamificationConfig }> {
    const response = await api.put<{
      message: string;
      config: GamificationConfig;
    }>("/gamification/config", config);
    return response.data;
  },

  async getRanking(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    businessId?: string;
  }): Promise<RankingResponse> {
    const response = await api.get<RankingResponse>("/gamification/ranking", {
      params,
    });
    return response.data;
  },

  async evaluatePeriod(data: {
    startDate: string;
    endDate: string;
    notes?: string;
  }): Promise<{ message: string; winner: PeriodWinner }> {
    const response = await api.post<{ message: string; winner: PeriodWinner }>(
      "/gamification/evaluate",
      data
    );
    return response.data;
  },

  async getWinners(params?: {
    limit?: number;
    page?: number;
    businessId?: string;
  }): Promise<WinnersResponse> {
    const response = await api.get<WinnersResponse>("/gamification/winners", {
      params,
    });
    return response.data;
  },

  async getDistributorStats(
    distributorId: string
  ): Promise<DistributorStatsResponse> {
    const response = await api.get<DistributorStatsResponse>(
      `/gamification/stats/${distributorId}`
    );
    return response.data;
  },

  async markBonusPaid(
    winnerId: string
  ): Promise<{ message: string; winner: PeriodWinner }> {
    const response = await api.put<{ message: string; winner: PeriodWinner }>(
      `/gamification/winners/${winnerId}/pay`
    );
    return response.data;
  },

  async getAchievements(): Promise<Achievement[]> {
    const response = await api.get<Achievement[]>("/gamification/achievements");
    return response.data;
  },

  async getAdjustedCommission(distributorId: string): Promise<{
    position: number | null;
    bonusCommission: number;
    periodStart: string;
    periodEnd: string;
    totalDistributors: number;
  }> {
    const response = await api.get(`/gamification/commission/${distributorId}`);
    return response.data;
  },

  async checkAndEvaluatePeriod(): Promise<{
    message: string;
    winner?: PeriodWinner;
  }> {
    const response = await api.post<{ message: string; winner?: PeriodWinner }>(
      "/gamification/check-period"
    );
    return response.data;
  },
};

// ==================== EXPENSE SERVICE ====================
export const expenseService = {
  async getAll(params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }): Promise<{ expenses: Expense[] }> {
    const response = await api.get("/expenses", { params });
    if (response.data?.expenses) return response.data;
    return { expenses: Array.isArray(response.data) ? response.data : [] };
  },

  async create(payload: {
    type: string;
    amount: number;
    description?: string;
    expenseDate?: string;
  }): Promise<{ expense: Expense }> {
    const response = await api.post("/expenses", payload);
    return response.data;
  },

  async getById(id: string): Promise<{ expense: Expense }> {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  async update(
    id: string,
    payload: Partial<{
      type: string;
      amount: number;
      description: string;
      expenseDate: string;
    }>
  ): Promise<{ expense: Expense }> {
    const response = await api.put(`/expenses/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },
};

// Types for Profit History
interface ProfitHistoryEntry {
  _id: string;
  userId: string;
  type: "venta_normal" | "venta_especial" | "ajuste" | "bonus";
  amount: number;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface ProfitHistoryResponse {
  success: boolean;
  data: ProfitHistoryEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface UserBalance {
  userId: string;
  totalEarned: number;
  totalWithdrawn: number;
  currentBalance: number;
}

interface ProfitSummary {
  totalProfit: number;
  byType: Array<{
    type: string;
    total: number;
    count: number;
  }>;
  timeline: Array<{
    date: string;
    amount: number;
  }>;
}

interface ComparativeAnalysis {
  currentPeriod: {
    total: number;
    count: number;
  };
  previousPeriod: {
    total: number;
    count: number;
  };
  growth: number;
}

interface ProfitHistoryAdminOverview {
  totalDistributed: number;
  pendingPayouts: number;
  topEarners: Array<{
    userId: string;
    userName: string;
    totalEarned: number;
  }>;
}

// ==================== PROFIT HISTORY SERVICE ====================
export const profitHistoryService = {
  async getUserHistory(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      type?: "venta_normal" | "venta_especial" | "ajuste" | "bonus";
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ProfitHistoryResponse> {
    const response = await api.get(`/profit-history/user/${userId}`, {
      params,
    });
    return response.data;
  },

  async getUserBalance(userId: string): Promise<UserBalance> {
    const response = await api.get(`/profit-history/balance/${userId}`);
    return response.data;
  },

  async getProfitSummary(params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }): Promise<ProfitSummary> {
    const response = await api.get("/profit-history/summary", { params });
    return response.data;
  },

  async getComparativeAnalysis(params?: {
    userId?: string;
  }): Promise<ComparativeAnalysis> {
    const response = await api.get("/profit-history/comparative", { params });
    return response.data;
  },

  async getAdminOverview(params?: {
    startDate?: string;
    endDate?: string;
    distributorId?: string;
    limit?: number;
  }): Promise<ProfitHistoryAdminOverview> {
    const response = await api.get("/profit-history/admin/overview", {
      params,
    });
    return response.data;
  },

  async createEntry(data: {
    userId: string;
    type: "venta_normal" | "venta_especial" | "ajuste" | "bonus";
    amount: number;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    message: string;
    data: ProfitHistoryEntry;
  }> {
    const response = await api.post("/profit-history", data);
    return response.data;
  },
};
