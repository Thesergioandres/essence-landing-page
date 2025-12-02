import type {
  Achievement,
  AnalyticsDashboard,
  AuditLog,
  AuditLogsResponse,
  AuditStats,
  Averages,
  Category,
  DailySummary,
  DefectiveProduct,
  DistributorProfit,
  DistributorStatsResponse,
  DistributorStock,
  EntityHistory,
  FinancialSummary,
  GamificationConfig,
  MonthlyProfitData,
  PeriodWinner,
  Product,
  ProductImage,
  ProductProfit,
  RankingResponse,
  Sale,
  SaleStats,
  StockAlert,
  TimelineData,
  User,
  UserActivity,
  WinnersResponse,
} from "../types";
import api from "./axios.ts";

interface AuthResponse extends User {
  token: string;
}

type ProductPayload = {
  name: string;
  description: string;
  purchasePrice: number;
  suggestedPrice?: number;
  distributorPrice: number;
  clientPrice?: number;
  distributorCommission?: number;
  category: string;
  totalStock: number;
  warehouseStock?: number;
  lowStockAlert?: number;
  featured: boolean;
  ingredients?: string[];
  benefits?: string[];
  image?: ProductImage | null;
};

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
    }

    return response.data;
  },

  logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser(): (AuthResponse & { token: string }) | null {
    const user = localStorage.getItem("user");
    return user ? (JSON.parse(user) as AuthResponse & { token: string }) : null;
  },

  async getProfile(): Promise<User> {
    const response = await api.get<User>("/auth/profile");
    return response.data;
  },
};

export const productService = {
  async getAll(
    filters: Record<string, string | boolean | number> = {}
  ): Promise<{ data: Product[]; pagination?: { page: number; limit: number; total: number; pages: number; hasMore: boolean } }> {
    const response = await api.get("/products", { params: filters });
    // Si viene con paginación (formato nuevo), retornar tal cual
    if (response.data.data && response.data.pagination) {
      return response.data;
    }
    // Si viene como array (formato antiguo sin paginación), adaptarlo
    return { data: Array.isArray(response.data) ? response.data : [], pagination: undefined };
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async getAllCategories(): Promise<Category[]> {
    return categoryService.getAll();
  },

  async create(productData: ProductPayload): Promise<Product> {
    const response = await api.post<Product>("/products", productData);
    return response.data;
  },

  async update(
    id: string,
    productData: Partial<ProductPayload>
  ): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, productData);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/products/${id}`);
    return response.data;
  },

  async getDistributorPrice(productId: string, distributorId: string): Promise<{
    productId: string;
    distributorId: string;
    purchasePrice: number;
    distributorPrice: number;
    profitPercentage: number;
    rankingPosition: number;
  }> {
    const response = await api.get(`/products/${productId}/distributor-price/${distributorId}`);
    return response.data;
  },
};

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

export const categoryService = {
  async getAll(): Promise<Category[]> {
    const response = await api.get<Category[]>("/categories");
    return response.data;
  },

  async getById(id: string): Promise<Category> {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
  }): Promise<Category> {
    const response = await api.post<Category>("/categories", data);
    return response.data;
  },

  async update(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Category> {
    const response = await api.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/categories/${id}`);
    return response.data;
  },
};

// ==================== DISTRIBUTOR SERVICE ====================
export const distributorService = {
  async getAll(active?: boolean | { active?: boolean; page?: number; limit?: number }): Promise<User[] | { data: User[]; pagination: { page: number; limit: number; total: number; pages: number; hasMore: boolean } }> {
    let params: any = {};
    if (typeof active === 'boolean') {
      params = { active };
    } else if (typeof active === 'object') {
      params = active;
    }
    const response = await api.get("/distributors", { params });
    // Compatibilidad: si viene con .data, es paginado
    return response.data.data ? response.data : { data: response.data, pagination: { page: 1, limit: response.data.length, total: response.data.length, pages: 1, hasMore: false } };
  },

  async getById(id: string): Promise<{
    distributor: User;
    stock: DistributorStock[];
    recentSales: Sale[];
    stats: { totalSales: number; totalProfit: number; totalRevenue: number };
  }> {
    const response = await api.get(`/distributors/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }): Promise<User> {
    const response = await api.post<User>("/distributors", data);
    return response.data;
  },

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      active?: boolean;
    }
  ): Promise<User> {
    const response = await api.put<User>(`/distributors/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/distributors/${id}`
    );
    return response.data;
  },

  async toggleActive(
    id: string
  ): Promise<{ message: string; active: boolean }> {
    const response = await api.patch<{ message: string; active: boolean }>(
      `/distributors/${id}/toggle-active`
    );
    return response.data;
  },
};

// ==================== STOCK SERVICE ====================
export const stockService = {
  async assignToDistributor(data: {
    distributorId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
    distributorStock: DistributorStock;
    warehouseStock: number;
  }> {
    const response = await api.post("/stock/assign", data);
    return response.data;
  },

  async withdrawFromDistributor(data: {
    distributorId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
    distributorStock: DistributorStock;
    warehouseStock: number;
  }> {
    const response = await api.post("/stock/withdraw", data);
    return response.data;
  },

  async getDistributorStock(
    distributorId: string
  ): Promise<DistributorStock[]> {
    const response = await api.get<DistributorStock[]>(
      `/stock/distributor/${distributorId}`
    );
    return response.data;
  },

  async getAllStock(): Promise<DistributorStock[]> {
    const response = await api.get<DistributorStock[]>("/stock/all");
    return response.data;
  },

  async getAlerts(): Promise<StockAlert> {
    const response = await api.get<StockAlert>("/stock/alerts");
    return response.data;
  },
};

// ==================== SALE SERVICE ====================
export const saleService = {
  async register(data: {
    productId: string;
    quantity: number;
    salePrice: number;
    notes?: string;
    saleDate?: string;
  }): Promise<{
    message: string;
    sale: Sale;
    remainingStock: number;
  }> {
    const response = await api.post("/sales", data);
    return response.data;
  },

  async registerAdmin(data: {
    productId: string;
    quantity: number;
    salePrice: number;
    notes?: string;
    saleDate?: string;
  }): Promise<{
    message: string;
    sale: Sale;
    remainingStock: number;
  }> {
    const response = await api.post("/sales/admin", data);
    return response.data;
  },

  async getDistributorSales(
    distributorId?: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      productId?: string;
    }
  ): Promise<{ sales: Sale[]; stats: SaleStats }> {
    const url = distributorId
      ? `/sales/distributor/${distributorId}`
      : "/sales/distributor";
    const response = await api.get(url, { params: filters });
    return response.data;
  },

  async getAllSales(filters?: {
    startDate?: string;
    endDate?: string;
    distributorId?: string;
    productId?: string;
    paymentStatus?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }): Promise<{ 
    sales: Sale[]; 
    stats: SaleStats & { confirmedSales?: number; pendingSales?: number; totalProfit?: number };
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasMore: boolean;
    };
  }> {
    const response = await api.get("/sales", { params: filters });
    return response.data;
  },

  async getSalesByProduct(): Promise<
    Array<{
      _id: string;
      productName: string;
      productImage?: ProductImage;
      totalQuantity: number;
      totalSales: number;
      totalRevenue: number;
      totalAdminProfit: number;
      totalDistributorProfit: number;
    }>
  > {
    const response = await api.get("/sales/report/by-product");
    return response.data;
  },

  async getSalesByDistributor(): Promise<
    Array<{
      _id: string;
      distributorName: string;
      distributorEmail: string;
      totalQuantity: number;
      totalSales: number;
      totalRevenue: number;
      totalAdminProfit: number;
      totalDistributorProfit: number;
    }>
  > {
    const response = await api.get("/sales/report/by-distributor");
    return response.data;
  },

  async confirmPayment(saleId: string): Promise<{
    message: string;
    sale: Sale;
  }> {
    const response = await api.put(`/sales/${saleId}/confirm-payment`);
    return response.data;
  },

  async deleteSale(saleId: string): Promise<{ message: string }> {
    const response = await api.delete(`/sales/${saleId}`);
    return response.data;
  },
};

// ==================== DEFECTIVE PRODUCT SERVICE ====================
export const defectiveProductService = {
  async report(data: {
    productId: string;
    quantity: number;
    reason: string;
    images?: ProductImage[];
  }): Promise<{
    message: string;
    report: DefectiveProduct;
    remainingStock: number;
  }> {
    const response = await api.post("/defective-products", data);
    return response.data;
  },

  async reportAdmin(data: {
    productId: string;
    quantity: number;
    reason: string;
    images?: ProductImage[];
  }): Promise<{
    message: string;
    report: DefectiveProduct;
    remainingStock: number;
  }> {
    const response = await api.post("/defective-products/admin", data);
    return response.data;
  },

  async getDistributorReports(
    distributorId?: string,
    status?: "pendiente" | "confirmado" | "rechazado"
  ): Promise<DefectiveProduct[]> {
    const url = distributorId
      ? `/defective-products/distributor/${distributorId}`
      : "/defective-products/distributor/me";
    const response = await api.get(url, { params: { status } });
    return response.data;
  },

  async getAllReports(filters?: {
    status?: "pendiente" | "confirmado" | "rechazado";
    distributorId?: string;
    productId?: string;
  }): Promise<{
    reports: DefectiveProduct[];
    stats: {
      total: number;
      pendiente: number;
      confirmado: number;
      rechazado: number;
      totalQuantity: number;
    };
  }> {
    const response = await api.get("/defective-products", { params: filters });
    return response.data;
  },

  async confirm(
    reportId: string,
    adminNotes?: string
  ): Promise<{
    message: string;
    report: DefectiveProduct;
  }> {
    const response = await api.put(`/defective-products/${reportId}/confirm`, {
      adminNotes,
    });
    return response.data;
  },

  async reject(
    reportId: string,
    adminNotes?: string
  ): Promise<{
    message: string;
    report: DefectiveProduct;
  }> {
    const response = await api.put(`/defective-products/${reportId}/reject`, {
      adminNotes,
    });
    return response.data;
  },
};

// ==================== ANALYTICS SERVICE ====================
export const analyticsService = {
  async getMonthlyProfit(): Promise<MonthlyProfitData> {
    const response = await api.get<MonthlyProfitData>(
      "/analytics/monthly-profit"
    );
    return response.data;
  },

  async getProfitByProduct(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ProductProfit[]> {
    const response = await api.get<ProductProfit[]>(
      "/analytics/profit-by-product",
      {
        params: filters,
      }
    );
    return response.data;
  },

  async getProfitByDistributor(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<DistributorProfit[]> {
    const response = await api.get<DistributorProfit[]>(
      "/analytics/profit-by-distributor",
      {
        params: filters,
      }
    );
    return response.data;
  },

  async getAverages(
    period: "day" | "week" | "month" = "month"
  ): Promise<Averages> {
    const response = await api.get<Averages>("/analytics/averages", {
      params: { period },
    });
    return response.data;
  },

  async getSalesTimeline(days: number = 30): Promise<TimelineData[]> {
    const response = await api.get<TimelineData[]>(
      "/analytics/sales-timeline",
      {
        params: { days },
      }
    );
    return response.data;
  },

  async getFinancialSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<FinancialSummary> {
    const response = await api.get<FinancialSummary>(
      "/analytics/financial-summary",
      {
        params: filters,
      }
    );
    return response.data;
  },

  async getAnalyticsDashboard(): Promise<AnalyticsDashboard> {
    const response = await api.get<AnalyticsDashboard>("/analytics/dashboard");
    return response.data;
  },
};

// ==================== AUDIT SERVICE ====================
export const auditService = {
  async getLogs(filters?: {
    page?: number;
    limit?: number;
    action?: string;
    module?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    severity?: string;
    entityType?: string;
    entityId?: string;
  }): Promise<AuditLogsResponse> {
    const response = await api.get<AuditLogsResponse>("/audit/logs", {
      params: filters,
    });
    return response.data;
  },

  async getLogById(id: string): Promise<AuditLog> {
    const response = await api.get<AuditLog>(`/audit/logs/${id}`);
    return response.data;
  },

  async getDailySummary(date?: string): Promise<DailySummary> {
    const response = await api.get<DailySummary>("/audit/daily-summary", {
      params: { date },
    });
    return response.data;
  },

  async getUserActivity(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<UserActivity> {
    const response = await api.get<UserActivity>(
      `/audit/user-activity/${userId}`,
      {
        params: filters,
      }
    );
    return response.data;
  },

  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit?: number
  ): Promise<EntityHistory> {
    const response = await api.get<EntityHistory>(
      `/audit/entity-history/${entityType}/${entityId}`,
      {
        params: { limit },
      }
    );
    return response.data;
  },

  async getStats(days?: number): Promise<AuditStats> {
    const response = await api.get<AuditStats>("/audit/stats", {
      params: { days },
    });
    return response.data;
  },

  async cleanupOldLogs(
    days: number
  ): Promise<{ message: string; deletedCount: number }> {
    const response = await api.delete<{
      message: string;
      deletedCount: number;
    }>("/audit/cleanup", {
      data: { days },
    });
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
