/**
 * Common/Utility Services
 * Extracted from monolithic api/services.ts
 * Handles uploads, issues, user access (god panel), gamification
 */

import api from "../../../api/axios";
import type { ProfitHistoryAdminOverview } from "../../analytics/types/analytics.types";
import type {
  Achievement,
  DistributorStatsResponse,
  GamificationConfig,
  PeriodWinner,
  RankingResponse,
  WinnersResponse,
} from "../../analytics/types/gamification.types";
import type { User } from "../../auth/types/auth.types";
import type { ProductImage } from "../../inventory/types/product.types";
import type { Expense } from "../types/common.types";

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

// ==================== UPLOAD SERVICE ====================
export const uploadService = {
  async uploadImage(file: File): Promise<ProductImage> {
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error("La imagen es muy grande. Maximo 5MB.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const response = await api.post("/upload", formData);
    const payload = response.data as { data?: ProductImage } | ProductImage;
    return (
      (payload as { data?: ProductImage }).data || (payload as ProductImage)
    );
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
      "/god/users"
    );
    return response.data.data || [];
  },

  async activate(id: string, duration?: DurationPayload): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/god/users/${id}/activate`,
      duration || {}
    );
    return response.data.user;
  },

  async suspend(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/god/users/${id}/suspend`
    );
    return response.data.user;
  },

  async remove(id: string): Promise<{
    deletedBusinesses: number;
    deletedDistributorUsers: number;
    deletedProducts: number;
    deletedSales: number;
    deletedCustomers: number;
    deletedCredits: number;
    deletedCategories: number;
    deletedInventoryEntries: number;
  }> {
    const response = await api.delete<{
      success: boolean;
      data: {
        deletedBusinesses: number;
        deletedDistributorUsers: number;
        deletedProducts: number;
        deletedSales: number;
        deletedCustomers: number;
        deletedCredits: number;
        deletedCategories: number;
        deletedInventoryEntries: number;
      };
      message: string;
    }>(`/god/users/${id}`);
    return response.data.data;
  },

  async extend(id: string, duration?: DurationPayload): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/god/users/${id}/extend`,
      duration || {}
    );
    return response.data.user;
  },

  async pause(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/god/users/${id}/pause`
    );
    return response.data.user;
  },

  async resume(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/god/users/${id}/resume`
    );
    return response.data.user;
  },

  async getGlobalMetrics(): Promise<GodMetricsResponse> {
    const response = await api.get<GodMetricsResponse>("/god/metrics");
    return response.data;
  },

  async getSubscriptionsSummary(): Promise<SubscriptionsSummaryResponse> {
    const response =
      await api.get<SubscriptionsSummaryResponse>("/god/subscriptions");
    return response.data;
  },
};

// ==================== GAMIFICATION SERVICE ====================
export const gamificationService = {
  async getConfig(): Promise<GamificationConfig> {
    const response = await api.get<GamificationConfig>("/gamification/config");
    return (response.data as any)?.data ?? response.data;
  },

  async updateConfig(
    config: Partial<GamificationConfig>
  ): Promise<{ message: string; config: GamificationConfig }> {
    const response = await api.put<{
      message: string;
      config: GamificationConfig;
    }>("/gamification/config", config);
    return (response.data as any)?.data ?? response.data;
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
    return (response.data as any)?.data ?? response.data;
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
    return (response.data as any)?.data ?? response.data;
  },

  async getWinners(params?: {
    limit?: number;
    page?: number;
    businessId?: string;
  }): Promise<WinnersResponse> {
    const response = await api.get<WinnersResponse>("/gamification/winners", {
      params,
    });
    const payload = (response.data as any)?.data ?? response.data;
    const pagination = payload?.pagination || {};
    return {
      winners: payload?.winners || [],
      currentPage: pagination.page || 1,
      totalPages: pagination.pages || 1,
      total: pagination.total || 0,
    };
  },

  async getDistributorStats(
    distributorId: string
  ): Promise<DistributorStatsResponse> {
    const response = await api.get<DistributorStatsResponse>(
      `/gamification/stats/${distributorId}`
    );
    return (response.data as any)?.data ?? response.data;
  },

  async markBonusPaid(
    winnerId: string
  ): Promise<{ message: string; winner: PeriodWinner }> {
    const response = await api.put<{ message: string; winner: PeriodWinner }>(
      `/gamification/winners/${winnerId}/pay`
    );
    return (response.data as any)?.data ?? response.data;
  },

  async getAchievements(): Promise<Achievement[]> {
    const response = await api.get<Achievement[]>("/gamification/achievements");
    return (response.data as any)?.data ?? response.data;
  },

  async getAdjustedCommission(distributorId: string): Promise<{
    position: number | null;
    bonusCommission: number;
    periodStart: string;
    periodEnd: string;
    totalDistributors: number;
  }> {
    const response = await api.get(`/gamification/commission/${distributorId}`);
    return (response.data as any)?.data ?? response.data;
  },

  async checkAndEvaluatePeriod(): Promise<{
    message: string;
    winner?: PeriodWinner;
  }> {
    const response = await api.post<{ message: string; winner?: PeriodWinner }>(
      "/gamification/check-period"
    );
    return (response.data as any)?.data ?? response.data;
  },
};

// ==================== EXPENSE SERVICE ====================
export const expenseService = {
  async getAll(params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }): Promise<{ expenses: Expense[]; total?: number }> {
    const response = await api.get("/expenses", { params });
    // Handle wrapped response { success: true, data: { expenses, total } }
    if (response.data?.data?.expenses) {
      return response.data.data;
    }
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
    const raw = response.data;
    const expense = raw?.data ?? raw?.expense ?? raw;
    return { expense };
  },

  async getById(id: string): Promise<{ expense: Expense }> {
    const response = await api.get(`/expenses/${id}`);
    const raw = response.data;
    const expense = raw?.data ?? raw?.expense ?? raw;
    return { expense };
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
    const raw = response.data;
    const expense = raw?.data ?? raw?.expense ?? raw;
    return { expense };
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

// ProfitHistoryAdminOverview se importa desde analytics.types.ts

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
    // El backend retorna {success: true, data: {...}}
    return response.data.data || response.data;
  },

  async getUserBalance(userId: string): Promise<UserBalance> {
    const response = await api.get(`/profit-history/balance/${userId}`);
    // El backend retorna {success: true, data: {...}}
    return response.data.data || response.data;
  },

  async getProfitSummary(params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }): Promise<ProfitSummary> {
    const response = await api.get("/profit-history/summary", { params });
    // El backend retorna {success: true, data: {...}}
    return response.data.data || response.data;
  },

  async getComparativeAnalysis(params?: {
    userId?: string;
  }): Promise<ComparativeAnalysis> {
    const response = await api.get("/profit-history/comparative", { params });
    // El backend retorna {success: true, data: {...}}
    return response.data.data || response.data;
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
    // El backend retorna {success: true, data: {...overview}}
    return response.data.data || response.data;
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
