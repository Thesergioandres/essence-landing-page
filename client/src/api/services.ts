import type {
  Achievement,
  AnalyticsDashboard,
  AuditLog,
  AuditLogsResponse,
  AuditStats,
  Averages,
  Category,
  ComparativeAnalysis,
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
  ProfitHistoryEntry,
  ProfitHistoryResponse,
  ProfitSummary,
  RankingResponse,
  Sale,
  SaleStats,
  StockAlert,
  TimelineData,
  User,
  UserActivity,
  UserBalance,
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

  async getAllUsers(): Promise<{ success: boolean; data: User[] }> {
    const response = await api.get("/users");
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

  async create(productData: ProductPayload & { imageFile?: File }): Promise<Product> {
    const formData = new FormData();
    
    // Agregar todos los campos del producto
    Object.entries(productData).forEach(([key, value]) => {
      if (key === 'imageFile') return; // El imageFile se maneja aparte
      if (key === 'image') return; // No enviar el objeto image antiguo
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    
    // Agregar la imagen si existe
    if (productData.imageFile) {
      formData.append('image', productData.imageFile);
    }
    
    const response = await api.post<Product>("/products", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async update(
    id: string,
    productData: Partial<ProductPayload> & { imageFile?: File }
  ): Promise<Product> {
    const formData = new FormData();
    
    // Agregar todos los campos del producto
    Object.entries(productData).forEach(([key, value]) => {
      if (key === 'imageFile') return; // El imageFile se maneja aparte
      if (key === 'image') return; // No enviar el objeto image antiguo
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    
    // Agregar la imagen si existe
    if (productData.imageFile) {
      formData.append('image', productData.imageFile);
    }
    
    const response = await api.put<Product>(`/products/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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

  async getDistributorProducts(): Promise<{ data: Product[] }> {
    const response = await api.get("/products/my-catalog");
    return { data: Array.isArray(response.data) ? response.data : response.data.data || [] };
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

  async transferStock(data: {
    toDistributorId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    success: boolean;
    message: string;
    transfer: {
      from: {
        distributorId: string;
        name: string;
        remainingStock: number;
      };
      to: {
        distributorId: string;
        name: string;
        newStock: number;
      };
      product: {
        id: string;
        name: string;
      };
      quantity: number;
    };
  }> {
    const response = await api.post("/stock/transfer", data);
    return response.data;
  },

  async getTransferHistory(params: {
    fromDistributor?: string;
    toDistributor?: string;
    product?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transfers: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats: {
      totalTransfers: number;
      totalQuantity: number;
    };
  }> {
    const response = await api.get("/stock/transfers", { params });
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

// Servicio de Analíticas Avanzadas
export const advancedAnalyticsService = {
  async getSalesTimeline(params: {
    period: "day" | "week" | "month";
    startDate?: string;
    endDate?: string;
  }): Promise<{
    timeline: Array<{
      period: string;
      totalSales: number;
      revenue: number;
      profit: number;
      salesCount: number;
    }>;
  }> {
    const response = await api.get("/advanced-analytics/sales-timeline", {
      params,
    });
    return response.data;
  },

  async getTopProducts(params?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    topProducts: Array<{
      _id: string;
      name: string;
      totalQuantity: number;
      totalRevenue: number;
      salesCount: number;
    }>;
  }> {
    const response = await api.get("/advanced-analytics/top-products", {
      params,
    });
    return response.data;
  },

  async getSalesByCategory(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    categoryDistribution: Array<{
      _id: string;
      categoryName: string;
      totalSales: number;
      revenue: number;
      percentage: number;
    }>;
  }> {
    const response = await api.get("/advanced-analytics/sales-by-category", {
      params,
    });
    return response.data;
  },

  async getDistributorRankings(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    rankings: Array<{
      _id: string;
      name: string;
      email: string;
      totalSales: number;
      revenue: number;
      profit: number;
      conversionRate: number;
      averageOrderValue: number;
      rank: number;
    }>;
  }> {
    const response = await api.get("/advanced-analytics/distributor-rankings", {
      params,
    });
    return response.data;
  },

  async getLowStockVisual(): Promise<{
    lowStockProducts: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      lowStockAlert: number;
      urgency: "critical" | "warning" | "normal";
      stockPercentage: number;
    }>;
  }> {
    const response = await api.get("/advanced-analytics/low-stock-visual");
    return response.data;
  },

  async getProductRotation(params?: {
    days?: number;
  }): Promise<{
    productRotation: Array<{
      productId: string;
      productName: string;
      totalSold: number;
      daysAnalyzed: number;
      rotationRate: number;
      averageDailySales: number;
      status: "high" | "medium" | "low";
    }>;
  }> {
    const response = await api.get("/advanced-analytics/product-rotation", {
      params,
    });
    return response.data;
  },

  async getFinancialKPIs(): Promise<{
    kpis: {
      todaySales: number;
      todayRevenue: number;
      todayProfit: number;
      weekSales: number;
      weekRevenue: number;
      weekProfit: number;
      monthSales: number;
      monthRevenue: number;
      monthProfit: number;
      averageTicket: number;
      totalActiveDistributors: number;
    };
  }> {
    const response = await api.get("/advanced-analytics/financial-kpis");
    return response.data;
  },

  async getComparativeAnalysis(params?: {
    currentMonth?: number;
    currentYear?: number;
  }): Promise<{
    comparison: {
      currentMonth: {
        sales: number;
        revenue: number;
        profit: number;
      };
      previousMonth: {
        sales: number;
        revenue: number;
        profit: number;
      };
      growth: {
        salesGrowth: number;
        revenueGrowth: number;
        profitGrowth: number;
      };
    };
  }> {
    const response = await api.get("/advanced-analytics/comparative-analysis", {
      params,
    });
    return response.data;
  },

  async getSalesFunnel(): Promise<{
    funnel: {
      pending: {
        count: number;
        totalValue: number;
      };
      confirmed: {
        count: number;
        totalValue: number;
      };
      conversionRate: number;
      averageConversionTime: number;
    };
  }> {
    const response = await api.get("/advanced-analytics/sales-funnel");
    return response.data;
  },
};

// ========================================
// SPECIAL SALES SERVICE
// ========================================

export const specialSaleService = {
  async create(data: {
    product: {
      name: string;
      productId?: string;
    };
    quantity: number;
    specialPrice: number;
    cost: number;
    distribution: Array<{
      name: string;
      amount: number;
      percentage?: number;
      notes?: string;
    }>;
    observations?: string;
    eventName?: string;
    saleDate?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const response = await api.post("/special-sales", data);
    return response.data;
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: "active" | "cancelled" | "refunded";
    productName?: string;
    eventName?: string;
    sortBy?: string;
  }): Promise<{
    success: boolean;
    count: number;
    total: number;
    page: number;
    pages: number;
    data: any[];
  }> {
    const response = await api.get("/special-sales", { params });
    return response.data;
  },

  async getById(id: string): Promise<{
    success: boolean;
    data: any;
  }> {
    const response = await api.get(`/special-sales/${id}`);
    return response.data;
  },

  async update(
    id: string,
    data: {
      product?: {
        name: string;
        productId?: string;
      };
      quantity?: number;
      specialPrice?: number;
      cost?: number;
      distribution?: Array<{
        name: string;
        amount: number;
        percentage?: number;
        notes?: string;
      }>;
      observations?: string;
      eventName?: string;
      saleDate?: string;
      status?: "active" | "cancelled" | "refunded";
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const response = await api.put(`/special-sales/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.delete(`/special-sales/${id}`);
    return response.data;
  },

  async cancel(id: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const response = await api.put(`/special-sales/${id}/cancel`);
    return response.data;
  },

  async getStatistics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: {
      totalSales: number;
      totalCosts: number;
      totalProfit: number;
      count: number;
      averageSale: number;
    };
  }> {
    const response = await api.get("/special-sales/stats/overview", { params });
    return response.data;
  },

  async getDistributionByPerson(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: Array<{
      _id: string;
      totalAmount: number;
      salesCount: number;
    }>;
  }> {
    const response = await api.get("/special-sales/stats/distribution", {
      params,
    });
    return response.data;
  },

  async getTopProducts(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: Array<{
      _id: string;
      totalQuantity: number;
      totalSales: number;
      totalProfit: number;
      salesCount: number;
      averagePrice: number;
    }>;
  }> {
    const response = await api.get("/special-sales/stats/top-products", {
      params,
    });
    return response.data;
  },
};

// ========================================
// PROFIT HISTORY SERVICE
// ========================================

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
    const response = await api.get(`/profit-history/user/${userId}`, { params });
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
