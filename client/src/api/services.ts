import { invalidateProductCache } from "../hooks";
import type {
  Achievement,
  AnalyticsDashboard,
  AuditLog,
  AuditLogsResponse,
  AuditStats,
  Averages,
  Branch,
  BranchStock,
  Business,
  BusinessAssistantConfig,
  BusinessAssistantJobStatus,
  BusinessAssistantRecommendationsResponse,
  BusinessFeatures,
  Category,
  ComparativeAnalysis,
  Credit,
  CreditMetrics,
  CreditPayment,
  CreditProfitInfo,
  DailySummary,
  DefectiveProduct,
  DistributorProfit,
  DistributorStatsResponse,
  DistributorStock,
  EntityHistory,
  Expense,
  FinancialSummary,
  GamificationConfig,
  IssueReport,
  Membership,
  MonthlyProfitData,
  Notification,
  PeriodWinner,
  Product,
  ProductImage,
  ProductProfit,
  ProfitHistoryAdminOverview,
  ProfitHistoryEntry,
  ProfitHistoryResponse,
  ProfitSummary,
  Promotion,
  PromotionMetrics,
  PromotionStats,
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
  refreshToken?: string;
  refreshExpiresAt?: string;
}

async function trySetBusinessForGod(role: string) {
  if (role !== "god") return;
  try {
    const { data } = await api.get<{ memberships: Membership[] }>(
      "/business/me/memberships"
    );
    const memberships = data?.memberships || [];
    if (memberships.length === 1 && memberships[0]?.business?._id) {
      localStorage.setItem("businessId", memberships[0].business._id);
    }
  } catch (error) {
    console.warn("No se pudo asignar businessId para god", error);
  }
}

type DurationPayload = {
  days?: number;
  months?: number;
  years?: number;
};

// Tipos para métricas globales GOD
interface GodCreditStatusMetrics {
  count: number;
  totalAmount: number;
  totalPaid: number;
}

interface GodMetrics {
  users: {
    total: number;
    byStatus: Record<string, number>;
    expiringSubscriptions: number;
  };
  businesses: {
    total: number;
    byStatus: Record<string, number>;
    activeMemberships: number;
  };
  products: { total: number };
  sales: {
    total: number;
    totalRevenue: number;
    totalProfit: number;
    avgSaleValue: number;
  };
  credits: {
    pending: GodCreditStatusMetrics;
    paid: GodCreditStatusMetrics;
    overdue: GodCreditStatusMetrics;
    totalOutstanding: number;
  };
  recentUsers: Array<{
    _id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    subscriptionExpiresAt?: string;
  }>;
  recentBusinesses: Array<{
    _id: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  topBusinessesBySales: Array<{
    businessId: string;
    businessName: string;
    salesCount: number;
    totalRevenue: number;
    totalProfit: number;
  }>;
}

interface GodMetricsResponse {
  success: boolean;
  metrics: GodMetrics;
}

interface SubscriptionsSummaryResponse {
  success: boolean;
  subscriptions: {
    expiringToday: number;
    expiringWeek: number;
    expiringMonth: number;
    recentExpired: Array<{
      _id: string;
      name: string;
      email: string;
      subscriptionExpiresAt: string;
    }>;
  };
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
  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
    logo?: { url: string; publicId: string } | null;
  }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", payload);

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
      if (response.data.refreshToken) {
        localStorage.setItem("refreshToken", response.data.refreshToken);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-changed"));
      }
    }

    return response.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    // Limpiar datos anteriores para evitar conflictos de sesión
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");

    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
      if (response.data.refreshToken) {
        localStorage.setItem("refreshToken", response.data.refreshToken);
      }
      await trySetBusinessForGod(response.data.role);
      if (typeof window !== "undefined") {
        // Disparar evento de cambio de auth para refrescar contextos
        window.dispatchEvent(new Event("auth-changed"));
        // Disparar evento personalizado para forzar refresh de business context
        window.dispatchEvent(
          new CustomEvent("session-refresh", {
            detail: { role: response.data.role, userId: response.data._id },
          })
        );
      }
    }

    return response.data;
  },

  async refreshToken(): Promise<{
    token: string;
    refreshToken: string;
  } | null> {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    try {
      const response = await api.post<{
        token: string;
        refreshToken: string;
        refreshExpiresAt: string;
        user: User;
      }>("/auth/refresh", { refreshToken });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("refreshToken", response.data.refreshToken);
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
      }

      return {
        token: response.data.token,
        refreshToken: response.data.refreshToken,
      };
    } catch (error) {
      // Si falla el refresh, limpiar tokens
      console.error("[UI ERROR] Token refresh failed", error);
      localStorage.removeItem("refreshToken");
      return null;
    }
  },

  logout(): void {
    const refreshToken = localStorage.getItem("refreshToken");

    // Intentar revocar el refresh token en el servidor
    if (refreshToken) {
      api.post("/auth/logout", { refreshToken }).catch(() => {
        // Ignorar errores de logout
      });
    }

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-changed"));
    }
  },

  getCurrentUser(): (AuthResponse & { token: string }) | null {
    const user = localStorage.getItem("user");
    return user ? (JSON.parse(user) as AuthResponse & { token: string }) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },

  hasRefreshToken(): boolean {
    return !!localStorage.getItem("refreshToken");
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

export const userAccessService = {
  async list(): Promise<User[]> {
    const response = await api.get<{ success: boolean; data: User[] }>(
      "/users/god/all"
    );
    return response.data.data || [];
  },

  async activate(id: string, duration?: DurationPayload): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/users/god/${id}/activate`,
      duration || {}
    );
    return response.data.user;
  },

  async suspend(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/users/god/${id}/suspend`
    );
    return response.data.user;
  },

  async remove(id: string): Promise<void> {
    await api.post(`/users/god/${id}/delete`);
  },

  async extend(id: string, duration?: DurationPayload): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/users/god/${id}/extend`,
      duration || {}
    );
    return response.data.user;
  },

  async pause(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/users/god/${id}/pause`
    );
    return response.data.user;
  },

  async resume(id: string): Promise<User> {
    const response = await api.post<{ success: boolean; user: User }>(
      `/users/god/${id}/resume`
    );
    return response.data.user;
  },

  async getGlobalMetrics(): Promise<GodMetricsResponse> {
    const response = await api.get<GodMetricsResponse>("/users/god/metrics");
    return response.data;
  },

  async getSubscriptionsSummary(): Promise<SubscriptionsSummaryResponse> {
    const response = await api.get<SubscriptionsSummaryResponse>(
      "/users/god/subscriptions"
    );
    return response.data;
  },
};

export const userService = {
  async findByEmail(email: string): Promise<User> {
    const response = await api.get<{ user: User }>(`/users/find/${email}`);
    return response.data.user;
  },
};

export const businessService = {
  async create(payload: {
    name: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactLocation?: string;
    features?: BusinessFeatures;
    logoUrl?: string;
    logoPublicId?: string;
  }): Promise<{ business: Business }> {
    const response = await api.post<{ business: Business }>(
      "/business",
      payload
    );
    return response.data;
  },

  async getMyMemberships(): Promise<{ memberships: Membership[] }> {
    const response = await api.get<{ memberships: Membership[] }>(
      "/business/me/memberships"
    );
    return response.data;
  },

  async updateBusiness(
    businessId: string,
    payload: Partial<{
      name: string;
      description: string;
      contactEmail: string;
      contactPhone: string;
      contactWhatsapp: string;
      contactLocation: string;
      logoUrl?: string;
      logoPublicId?: string | null;
    }>
  ): Promise<{ business: unknown }> {
    const response = await api.patch<{ business: unknown }>(
      `/business/${businessId}`,
      payload
    );
    return response.data;
  },

  async updateBusinessFeatures(
    businessId: string,
    features: {
      products?: boolean;
      inventory?: boolean;
      sales?: boolean;
      gamification?: boolean;
      incidents?: boolean;
      expenses?: boolean;
      assistant?: boolean;
      reports?: boolean;
      transfers?: boolean;
    }
  ): Promise<{ business: unknown }> {
    const response = await api.patch<{ business: unknown }>(
      `/business/${businessId}/features`,
      { features }
    );
    return response.data;
  },

  async listMembers(businessId: string): Promise<Membership[]> {
    const response = await api.get<{ members: Membership[] }>(
      `/business/${businessId}/members`
    );
    return response.data.members || [];
  },

  async updateMemberBranches(
    businessId: string,
    membershipId: string,
    allowedBranches: string[]
  ): Promise<{ membership: Membership }> {
    const response = await api.patch<{ membership: Membership }>(
      `/business/${businessId}/members/${membershipId}`,
      { allowedBranches }
    );
    return response.data;
  },

  async addMember(
    businessId: string,
    payload: {
      userId: string;
      role: "admin" | "distribuidor" | "viewer";
      permissions?: Record<string, unknown>;
      allowedBranches?: string[];
    }
  ): Promise<{ membership: Membership }> {
    const response = await api.post<{ membership: Membership }>(
      `/business/${businessId}/members`,
      payload
    );
    return response.data;
  },

  async updateMemberPermissions(
    businessId: string,
    membershipId: string,
    permissions: Record<string, unknown>
  ): Promise<{ membership: Membership }> {
    const response = await api.patch<{ membership: Membership }>(
      `/business/${businessId}/members/${membershipId}`,
      { permissions }
    );
    return response.data;
  },

  async removeMember(
    businessId: string,
    membershipId: string
  ): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/business/${businessId}/members/${membershipId}`
    );
    return response.data;
  },
};

// ==================== BUSINESS ASSISTANT SERVICE ====================
export const businessAssistantService = {
  async getRecommendations(params?: {
    horizonDays?: number;
    recentDays?: number;
    startDate?: string;
    endDate?: string;
    force?: 1 | 0;
  }): Promise<BusinessAssistantRecommendationsResponse> {
    const response = await api.get<BusinessAssistantRecommendationsResponse>(
      "/business-assistant/recommendations",
      { params }
    );
    return response.data;
  },

  async getConfig(): Promise<BusinessAssistantConfig> {
    const response = await api.get<BusinessAssistantConfig>(
      "/business-assistant/config"
    );
    return response.data;
  },

  async updateConfig(
    patch: Partial<BusinessAssistantConfig>
  ): Promise<BusinessAssistantConfig> {
    const response = await api.put<BusinessAssistantConfig>(
      "/business-assistant/config",
      patch
    );
    return response.data;
  },

  async createRecommendationsJob(params?: {
    horizonDays?: number;
    recentDays?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ jobId: string }> {
    const response = await api.post<{ jobId: string }>(
      "/business-assistant/recommendations/jobs",
      params || {}
    );
    return response.data;
  },

  async getRecommendationsJob(
    jobId: string
  ): Promise<BusinessAssistantJobStatus> {
    const response = await api.get<BusinessAssistantJobStatus>(
      `/business-assistant/recommendations/jobs/${jobId}`
    );
    return response.data;
  },

  async getStrategicAnalysis(question?: string): Promise<{
    success: boolean;
    analysis: string;
    context: any;
  }> {
    const response = await api.post<{
      success: boolean;
      analysis: string;
      context: any;
    }>("/business-assistant/analyze-strategic", { question });
    return response.data;
  },

  async getLatestAnalysis(): Promise<{
    success: boolean;
    analysis: string;
    lastUpdated: string;
    type: string;
  }> {
    const response = await api.get<{
      success: boolean;
      analysis: string;
      lastUpdated: string;
      type: string;
    }>("/business-assistant/latest");
    return response.data;
  },
};

export const productService = {
  async getAll(
    filters: Record<string, string | boolean | number> = {}
  ): Promise<{
    data: Product[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasMore: boolean;
    };
  }> {
    const response = await api.get("/products", { params: filters });
    // Si viene con paginación (formato nuevo), retornar tal cual
    if (response.data.data && response.data.pagination) {
      return response.data;
    }
    // Si viene como array (formato antiguo sin paginación), adaptarlo
    return {
      data: Array.isArray(response.data) ? response.data : [],
      pagination: undefined,
    };
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async getAllCategories(): Promise<Category[]> {
    return categoryService.getAll();
  },

  async create(
    productData: ProductPayload & { imageFile?: File }
  ): Promise<Product> {
    const formData = new FormData();

    Object.entries(productData).forEach(([key, value]) => {
      if (key === "imageFile") return;
      if (key === "image") return;
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      }
    });

    if (productData.imageFile) {
      formData.append("image", productData.imageFile);
    }

    const response = await api.post<Product>("/products", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    // Invalidar caché de productos al crear uno nuevo
    invalidateProductCache();
    return response.data;
  },

  async update(
    id: string,
    productData: Partial<ProductPayload> & { imageFile?: File }
  ): Promise<Product> {
    const formData = new FormData();

    // Agregar todos los campos del producto
    Object.entries(productData).forEach(([key, value]) => {
      if (key === "imageFile") return; // El imageFile se maneja aparte
      if (key === "image") return; // No enviar el objeto image antiguo
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      }
    });

    // Agregar la imagen si existe
    if (productData.imageFile) {
      formData.append("image", productData.imageFile);
    }

    const response = await api.put<Product>(`/products/${id}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    // Invalidar caché de productos al actualizar
    invalidateProductCache();
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/products/${id}`);
    // Invalidar caché de productos al eliminar
    invalidateProductCache();
    return response.data;
  },

  async getDistributorPrice(
    productId: string,
    distributorId: string
  ): Promise<{
    productId: string;
    distributorId: string;
    purchasePrice: number;
    distributorPrice: number;
    profitPercentage: number;
    rankingPosition: number;
  }> {
    const response = await api.get(
      `/products/${productId}/distributor-price/${distributorId}`
    );
    return response.data;
  },

  async getDistributorProducts(): Promise<{ data: Product[] }> {
    const response = await api.get("/products/my-catalog");
    return {
      data: Array.isArray(response.data)
        ? response.data
        : response.data.data || [],
    };
  },

  async initializeAverageCost(): Promise<{
    message: string;
    updatedCount: number;
    updates: Array<{
      _id: string;
      name: string;
      purchasePrice: number;
      averageCost: number;
      totalStock: number;
      totalInventoryValue: number;
    }>;
  }> {
    const response = await api.post("/products/initialize-average-cost");
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

export const categoryService = {
  async getAll(
    params?: Record<string, string | boolean | number>
  ): Promise<Category[]> {
    const response = await api.get<Category[]>("/categories", { params });
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
  async getAll(
    active?: boolean | { active?: boolean; page?: number; limit?: number }
  ): Promise<
    | User[]
    | {
        data: User[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
          hasMore: boolean;
        };
      }
  > {
    let params: any = {};
    if (typeof active === "boolean") {
      params = { active };
    } else if (typeof active === "object") {
      params = active;
    }
    const response = await api.get("/distributors", { params });
    // Compatibilidad: si viene con .data, es paginado
    return response.data.data
      ? response.data
      : {
          data: response.data,
          pagination: {
            page: 1,
            limit: response.data.length,
            total: response.data.length,
            pages: 1,
            hasMore: false,
          },
        };
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

  async getBranchStock(branchId?: string): Promise<BranchStock[]> {
    const url = branchId ? `/stock/branch/${branchId}` : "/stock/branch";
    const response = await api.get<{ data?: BranchStock[] } | BranchStock[]>(
      url
    );
    const payload = (response as any).data ?? response;
    if (Array.isArray(payload)) return payload as BranchStock[];
    return payload?.data ?? [];
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

  async transferStockToBranch(data: {
    toBranchId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
  }> {
    const response = await api.post("/stock/transfer-to-branch", data);
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

  async getMyAllowedBranches(): Promise<{
    branches: Array<{
      _id: string;
      name: string;
      address?: string;
      isWarehouse?: boolean;
      stock: Array<{
        product: {
          _id: string;
          name: string;
          image?: string;
          clientPrice?: number;
          distributorPrice?: number;
        };
        quantity: number;
      }>;
      totalProducts: number;
      totalUnits: number;
    }>;
    message?: string;
  }> {
    const response = await api.get("/stock/my-allowed-branches");
    return response.data;
  },
};

// ==================== BRANCH SERVICE ====================
export const branchService = {
  async list(): Promise<Branch[]> {
    const response = await api.get("/branches");
    return response.data?.data ?? response.data ?? [];
  },

  async create(data: {
    name: string;
    address?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    timezone?: string;
    config?: Branch["config"];
  }): Promise<Branch> {
    const response = await api.post("/branches", data);
    return response.data?.branch ?? response.data;
  },

  async update(
    id: string,
    data: {
      name?: string;
      address?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      timezone?: string;
      config?: Branch["config"];
      active?: boolean;
    }
  ): Promise<Branch> {
    const response = await api.patch(`/branches/${id}`, data);
    return response.data?.branch ?? response.data;
  },

  async remove(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/branches/${id}`);
    return response.data;
  },
};

// ==================== BRANCH TRANSFER SERVICE ====================
export const branchTransferService = {
  async create(data: {
    originBranchId: string;
    targetBranchId: string;
    items: Array<{ product: string; quantity: number }>;
    notes?: string;
  }): Promise<any> {
    const response = await api.post("/branch-transfers", data);
    return response.data;
  },

  async list(): Promise<any> {
    const response = await api.get("/branch-transfers");
    return response.data?.data ?? response.data ?? [];
  },
};

// ==================== SALE SERVICE ====================
export const saleService = {
  async register(data: {
    productId: string;
    quantity: number;
    salePrice: number;
    branchId?: string;
    notes?: string;
    saleDate?: string;
    paymentType?: string;
    paymentMethodId?: string;
    customerId?: string;
    creditDueDate?: string;
    initialPayment?: number;
    paymentProof?: string;
    paymentProofMimeType?: string;
    deliveryMethodId?: string;
    shippingCost?: number;
    deliveryAddress?: string;
    additionalCosts?: Array<{
      type: string;
      description: string;
      amount: number;
    }>;
    discount?: number;
    saleGroupId?: string; // ⭐ Campo para agrupar ventas del mismo carrito
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
    branchId?: string;
    notes?: string;
    saleDate?: string;
    paymentType?: string;
    paymentMethodId?: string;
    customerId?: string;
    creditDueDate?: string;
    initialPayment?: number;
    deliveryMethodId?: string;
    shippingCost?: number;
    deliveryAddress?: string;
    additionalCosts?: Array<{
      type: string;
      description: string;
      amount: number;
    }>;
    discount?: number;
    saleGroupId?: string;
    warranties?: Array<{
      productId: string;
      quantity: number;
      hasWarranty: boolean;
    }>;
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
      limit?: number;
      statsOnly?: boolean;
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
    statsOnly?: boolean;
  }): Promise<{
    sales: Sale[];
    stats: SaleStats & {
      confirmedSales?: number;
      pendingSales?: number;
      totalProfit?: number;
    };
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

  // ⭐ Eliminar grupo de ventas completo
  async deleteSaleGroup(saleGroupId: string): Promise<{
    message: string;
    deletedSales: number;
    deletedCredits: number;
    deletedWarranties: number;
    stockRestored: number;
  }> {
    const response = await api.delete(`/sales/group/${saleGroupId}`);
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

  async reportFromBranch(data: {
    branchId: string;
    productId: string;
    quantity: number;
    reason: string;
    images?: ProductImage[];
  }): Promise<{
    message: string;
    report: DefectiveProduct;
    remainingStock: number;
  }> {
    const response = await api.post("/defective-products/branch", data);
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
    adminNotes?: string,
    hasWarranty?: boolean
  ): Promise<{
    message: string;
    report: DefectiveProduct;
  }> {
    const response = await api.put(`/defective-products/${reportId}/confirm`, {
      adminNotes,
      hasWarranty,
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

  async delete(reportId: string): Promise<{
    message: string;
    restoredQuantity: number;
    restoredTo: string;
  }> {
    const response = await api.delete(`/defective-products/${reportId}`);
    return response.data;
  },

  async getStats(): Promise<{
    stats: {
      totalReports: number;
      totalQuantity: number;
      totalLoss: number;
      pendingCount: number;
      confirmedCount: number;
      withWarranty: number;
      warrantyPending: number;
      warrantyApproved: number;
      stockRestored: number;
    };
  }> {
    const response = await api.get("/defective-products/stats");
    return response.data;
  },

  async getBySaleGroup(saleGroupId: string): Promise<{
    defectiveProducts: DefectiveProduct[];
  }> {
    const response = await api.get(
      `/defective-products/sale-group/${saleGroupId}`
    );
    return response.data;
  },

  async approveWarranty(
    reportId: string,
    adminNotes?: string
  ): Promise<{
    message: string;
    report: DefectiveProduct;
    newStock: {
      warehouseStock: number;
      totalStock: number;
    };
  }> {
    const response = await api.put(
      `/defective-products/${reportId}/approve-warranty`,
      { adminNotes }
    );
    return response.data;
  },

  async rejectWarranty(
    reportId: string,
    adminNotes?: string
  ): Promise<{
    message: string;
    report: DefectiveProduct;
  }> {
    const response = await api.put(
      `/defective-products/${reportId}/reject-warranty`,
      { adminNotes }
    );
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
    period: "day" | "week" | "month" = "month",
    filters?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Averages> {
    const response = await api.get<Averages>("/analytics/averages", {
      params: { period, ...filters },
    });
    return response.data;
  },

  async getSalesTimeline(
    params:
      | number
      | {
          days?: number;
          startDate?: string;
          endDate?: string;
        } = 30
  ): Promise<TimelineData[]> {
    const resolvedParams =
      typeof params === "number" ? { days: params } : { days: 30, ...params };
    const response = await api.get<TimelineData[]>(
      "/analytics/sales-timeline",
      {
        params: resolvedParams,
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

  async getPaymentMethodMetrics(params?: {
    startDate?: string;
    endDate?: string;
    paymentMethodId?: string;
    paymentMethodCode?: string;
  }): Promise<{
    success: boolean;
    data: {
      byPaymentMethod: Array<{
        paymentMethodId: string | null;
        paymentMethodCode: string;
        paymentMethodName: string;
        isCredit: boolean;
        totalSales: number;
        totalRevenue: number;
        totalProfit: number;
        averageTicket: number;
        percentageOfTotal: number;
      }>;
      totals: {
        totalSales: number;
        totalRevenue: number;
        totalProfit: number;
        averageTicket: number;
      };
      filters: {
        startDate?: string;
        endDate?: string;
        paymentMethodId?: string;
        paymentMethodCode?: string;
      };
    };
  }> {
    const response = await api.get("/analytics/payment-methods", { params });
    return response.data;
  },

  async getEstimatedProfit(): Promise<{
    success: boolean;
    scenario: "A" | "B" | "C" | "D";
    message: string;
    hasBranches: boolean;
    hasDistributors: boolean;
    warehouse: {
      grossProfit: number;
      adminProfit: number;
      netProfit: number;
      totalProducts: number;
      totalUnits: number;
      investment: number;
      salesValue: number;
    };
    branches: {
      grossProfit: number;
      adminProfit: number;
      netProfit: number;
      totalProducts: number;
      totalUnits: number;
      investment: number;
      salesValue: number;
      branches: Array<{
        id: string;
        name: string;
        grossProfit: number;
        adminProfit: number;
        investment: number;
        salesValue: number;
        totalProducts: number;
        totalUnits: number;
      }>;
    };
    distributors: {
      grossProfit: number;
      adminProfit: number;
      netProfit: number;
      totalProducts: number;
      totalUnits: number;
      investment: number;
      salesValue: number;
      distributors: Array<{
        id: string;
        name: string;
        email: string;
        grossProfit: number;
        adminProfit: number;
        investment: number;
        salesValue: number;
        totalProducts: number;
        totalUnits: number;
      }>;
    };
    consolidated: {
      grossProfit: number;
      adminProfit: number;
      netProfit: number;
      totalProducts: number;
      totalUnits: number;
      investment: number;
      salesValue: number;
    };
  }> {
    const response = await api.get("/analytics/estimated-profit");
    return response.data;
  },

  async getDistributorEstimatedProfit(distributorId: string): Promise<{
    success: boolean;
    distributorId: string;
    estimate: {
      grossProfit: number;
      netProfit: number;
      totalProducts: number;
      totalUnits: number;
      investment: number;
      salesValue: number;
      profitMargin: string;
      profitability?: number;
      products: Array<{
        productId: string;
        name: string;
        image?: { url: string; publicId: string };
        quantity: number;
        distributorPrice: number;
        clientPrice: number;
        investment: number;
        salesValue: number;
        estimatedProfit: number;
        profitPercentage: string;
      }>;
    };
  }> {
    const response = await api.get(
      `/analytics/estimated-profit/distributor/${distributorId}`
    );
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

  async getProductRotation(params?: { days?: number }): Promise<{
    productRotation: Array<{
      _id: string;
      name: string;
      totalSold: number;
      frequency: number;
      currentStock: number;
      rotationRate: number;
    }>;
  }> {
    const response = await api.get("/advanced-analytics/product-rotation", {
      params,
    });
    return response.data;
  },

  async getFinancialKPIs(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    daily: { sales: number; revenue: number; profit: number };
    weekly: { sales: number; revenue: number; profit: number };
    monthly: { sales: number; revenue: number; profit: number };
    avgTicket: number;
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
    const response = await api.get("/advanced-analytics/financial-kpis", {
      params,
    });
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

  async getSalesFunnel(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
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
    };
  }> {
    const response = await api.get("/advanced-analytics/sales-funnel", {
      params,
    });
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

// ==================== EXPENSES (ADMIN) ====================
export const expenseService = {
  async getAll(params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }): Promise<{ expenses: Expense[] }> {
    const response = await api.get("/expenses", { params });
    // Formato esperado: { expenses }
    if (response.data?.expenses) return response.data;
    // Compatibilidad: si viene como array
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

// ==================== CREDIT/FIADO SERVICE ====================
export const creditService = {
  async getAll(params?: {
    status?: string;
    customerId?: string;
    branchId?: string;
    overdue?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    credits: Credit[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get("/credits", { params });
    return response.data;
  },

  async getById(id: string): Promise<{
    credit: Credit;
    payments: CreditPayment[];
    profitInfo?: CreditProfitInfo;
  }> {
    const response = await api.get(`/credits/${id}`);
    return response.data;
  },

  async create(payload: {
    customerId: string;
    amount: number;
    dueDate?: string;
    description?: string;
    items?: Array<{
      product?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    saleId?: string;
    branchId?: string;
  }): Promise<{ credit: Credit }> {
    const response = await api.post("/credits", payload);
    return response.data;
  },

  async registerPayment(
    creditId: string,
    payload: {
      amount: number;
      paymentMethod?: "cash" | "transfer" | "card" | "other";
      notes?: string;
      branchId?: string;
      paymentDate?: string;
      paymentProof?: string;
      paymentProofMimeType?: string;
    }
  ): Promise<{ payment: CreditPayment; credit: Credit }> {
    const response = await api.post(`/credits/${creditId}/payments`, payload);
    return response.data;
  },

  async registerDistributorPayment(
    creditId: string,
    payload: {
      amount: number;
      paymentMethod?: "cash" | "transfer" | "card" | "other";
      notes?: string;
      paymentProof?: string;
      paymentProofMimeType?: string;
    }
  ): Promise<{ payment: CreditPayment; credit: Credit; message: string }> {
    const response = await api.post(
      `/credits/${creditId}/distributor-payment`,
      payload
    );
    return response.data;
  },

  async getDistributorCredits(): Promise<{
    credits: Credit[];
    stats: {
      totalCredits: number;
      pendingCount: number;
      totalPending: number;
      totalCollected: number;
    };
  }> {
    const response = await api.get("/credits/my-sales");
    return response.data;
  },

  async getPaymentHistory(
    creditId: string
  ): Promise<{ payments: CreditPayment[] }> {
    const response = await api.get(`/credits/${creditId}/payments`);
    return response.data;
  },

  async cancel(creditId: string, reason?: string): Promise<{ credit: Credit }> {
    const response = await api.post(`/credits/${creditId}/cancel`, { reason });
    return response.data;
  },

  async delete(creditId: string): Promise<{ message: string }> {
    const response = await api.delete(`/credits/${creditId}`);
    return response.data;
  },

  async getMetrics(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ metrics: CreditMetrics }> {
    const response = await api.get("/credits/metrics", { params });
    return response.data;
  },

  async getCustomerCredits(customerId: string): Promise<{
    credits: Credit[];
    summary: {
      totalCredits: number;
      totalOriginal: number;
      totalPending: number;
      totalPaid: number;
    };
  }> {
    const response = await api.get(`/credits/customer/${customerId}`);
    return response.data;
  },
};

// ==================== NOTIFICATION SERVICE ====================
export const notificationService = {
  async getAll(params?: {
    read?: boolean;
    type?: string;
    limit?: number;
    page?: number;
  }): Promise<{
    notifications: Notification[];
    unreadCount: number;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get("/notifications", { params });
    return response.data;
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const response = await api.get("/notifications/unread-count");
    return response.data;
  },

  async markAsRead(id: string): Promise<{ notification: Notification }> {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    const response = await api.post("/notifications/read-all");
    return response.data;
  },

  async create(payload: {
    type: string;
    title: string;
    message: string;
    priority?: "low" | "medium" | "high" | "urgent";
    link?: string;
    targetUserId?: string;
    targetRole?: "admin" | "distribuidor" | "all";
    data?: Record<string, unknown>;
  }): Promise<{ notification: Notification }> {
    const response = await api.post("/notifications", payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  async cleanup(daysOld?: number): Promise<{ deletedCount: number }> {
    const response = await api.delete("/notifications/cleanup", {
      params: { daysOld },
    });
    return response.data;
  },
};

// ==================== PROMOTION SERVICE ====================
export const promotionService = {
  async getAll(params?: {
    status?: string;
    type?: string;
    showInCatalog?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    promotions: Promotion[];
    stats: PromotionStats;
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get("/promotions", { params });
    return response.data;
  },

  async getById(id: string): Promise<{ promotion: Promotion }> {
    const response = await api.get(`/promotions/${id}`);
    return response.data;
  },

  async create(payload: Partial<Promotion>): Promise<{ promotion: Promotion }> {
    const response = await api.post("/promotions", payload);
    return response.data;
  },

  async update(
    id: string,
    payload: Partial<Promotion>
  ): Promise<{ promotion: Promotion }> {
    const response = await api.put(`/promotions/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/promotions/${id}`);
    return response.data;
  },

  async toggleStatus(
    id: string
  ): Promise<{ promotion: Promotion; message: string }> {
    const response = await api.patch(`/promotions/${id}/toggle-status`);
    return response.data;
  },

  async checkStock(
    id: string,
    quantity?: number
  ): Promise<{
    available: boolean;
    maxAvailable: number;
    stockIssues: Array<{
      product: string;
      productId: string;
      required: number;
      available: number;
      shortfall: number;
    }>;
    requestedQuantity: number;
  }> {
    const response = await api.get(`/promotions/${id}/check-stock`, {
      params: { quantity },
    });
    return response.data;
  },

  async getMetrics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PromotionMetrics> {
    const response = await api.get("/promotions/metrics", { params });
    return response.data;
  },

  async getCatalogPromotions(): Promise<{ promotions: Promotion[] }> {
    const response = await api.get("/promotions/catalog");
    return response.data;
  },

  async evaluate(
    id: string,
    payload: {
      items: Array<{ product: string; quantity: number; price: number }>;
      branchId?: string;
      customerId?: string;
      segments?: string[];
    }
  ): Promise<{
    result: {
      applicable: boolean;
      discountAmount: number;
      appliedTimes?: number;
      exclusive?: boolean;
      subtotal?: number;
      reason?: string;
    };
  }> {
    const response = await api.post(`/promotions/${id}/evaluate`, payload);
    return response.data;
  },
};

// ==================== PROVIDER SERVICE ====================
interface Provider {
  _id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  totalOrders?: number;
  totalSpent?: number;
}

export const providerService = {
  async getAll(params?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    providers: Provider[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get("/providers", { params });
    return response.data;
  },

  async getById(id: string): Promise<{ provider: Provider }> {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  },

  async create(payload: Partial<Provider>): Promise<{ provider: Provider }> {
    const response = await api.post("/providers", payload);
    return response.data;
  },

  async update(
    id: string,
    payload: Partial<Provider>
  ): Promise<{ provider: Provider }> {
    const response = await api.put(`/providers/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/providers/${id}`);
    return response.data;
  },

  async toggleStatus(id: string): Promise<{ provider: Provider }> {
    const response = await api.patch(`/providers/${id}/toggle`);
    return response.data;
  },
};

// ==================== CUSTOMER SERVICE ====================
interface CustomerData {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  segment?: string;
  segments?: string[];
  points: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  totalSpend: number;
  totalDebt: number;
  ordersCount: number;
  lastPurchaseAt?: string;
  createdAt: string;
}

export const customerService = {
  async getAll(params?: {
    search?: string;
    segment?: string;
    hasDebt?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    customers: CustomerData[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get("/customers", { params });
    return response.data;
  },

  async getById(id: string): Promise<{ customer: CustomerData }> {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  async create(
    payload: Partial<CustomerData>
  ): Promise<{ customer: CustomerData }> {
    const response = await api.post("/customers", payload);
    return response.data;
  },

  async update(
    id: string,
    payload: Partial<CustomerData>
  ): Promise<{ customer: CustomerData }> {
    const response = await api.put(`/customers/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  async getPurchaseHistory(
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    purchases: Array<{
      _id: string;
      saleId: string;
      amount: number;
      date: string;
      products: string[];
    }>;
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get(`/customers/${id}/purchases`, { params });
    return response.data;
  },

  async getWithDebt(): Promise<{ customers: CustomerData[] }> {
    const response = await api.get("/customers", { params: { hasDebt: true } });
    return response.data;
  },
};

// ==================== SEGMENT SERVICE ====================
interface Segment {
  _id: string;
  name: string;
  key: string;
  description?: string;
  rules?: Record<string, unknown>;
  createdAt: string;
}

export const segmentService = {
  async getAll(): Promise<{ segments: Segment[] }> {
    const response = await api.get("/segments");
    return response.data;
  },

  async getById(id: string): Promise<{ segment: Segment }> {
    const response = await api.get(`/segments/${id}`);
    return response.data;
  },

  async create(payload: {
    name: string;
    key: string;
    description?: string;
    rules?: Record<string, unknown>;
  }): Promise<{ segment: Segment }> {
    const response = await api.post("/segments", payload);
    return response.data;
  },

  async update(
    id: string,
    payload: Partial<Segment>
  ): Promise<{ segment: Segment }> {
    const response = await api.put(`/segments/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/segments/${id}`);
    return response.data;
  },
};

// ==================== CUSTOMER POINTS SERVICE ====================
export const customerPointsService = {
  async getBalance(customerId: string): Promise<{
    points: number;
    history: Array<{
      type: string;
      amount: number;
      balance: number;
      description: string;
      createdAt: string;
    }>;
  }> {
    const response = await api.get(`/customer-points/${customerId}`);
    return response.data;
  },

  async adjustPoints(
    customerId: string,
    payload: { amount: number; reason: string; type: "bonus" | "adjustment" }
  ): Promise<{ customer: CustomerData }> {
    const response = await api.post(
      `/customer-points/${customerId}/adjust`,
      payload
    );
    return response.data;
  },

  async redeemPoints(
    customerId: string,
    payload: { points: number; description?: string }
  ): Promise<{ customer: CustomerData; redeemed: number }> {
    const response = await api.post(
      `/customer-points/${customerId}/redeem`,
      payload
    );
    return response.data;
  },

  async getRedemptionHistory(customerId: string): Promise<{
    redemptions: Array<{
      _id: string;
      points: number;
      description: string;
      date: string;
    }>;
  }> {
    const response = await api.get(
      `/customer-points/${customerId}/redemptions`
    );
    return response.data;
  },
};

// ==================== PUSH SUBSCRIPTION SERVICE ====================
export const pushSubscriptionService = {
  async getVapidPublicKey(): Promise<{ publicKey: string }> {
    const response = await api.get("/push-subscriptions/vapid-public-key");
    return response.data;
  },

  async subscribe(
    subscription: PushSubscriptionJSON
  ): Promise<{ message: string }> {
    const response = await api.post("/push-subscriptions/subscribe", {
      subscription,
    });
    return response.data;
  },

  async unsubscribe(endpoint: string): Promise<{ message: string }> {
    const response = await api.post("/push-subscriptions/unsubscribe", {
      endpoint,
    });
    return response.data;
  },

  async getStatus(): Promise<{
    subscribed: boolean;
    subscriptionsCount: number;
  }> {
    const response = await api.get("/push-subscriptions/status");
    return response.data;
  },

  async testNotification(): Promise<{ message: string }> {
    const response = await api.post("/push-subscriptions/test");
    return response.data;
  },
};

// ==================== INVENTORY SERVICE ====================
interface InventoryEntry {
  _id: string;
  product: { _id: string; name: string };
  branch?: { _id: string; name: string };
  provider?: { _id: string; name: string };
  user: { _id: string; name: string };
  quantity: number;
  notes?: string;
  destination: "branch" | "warehouse";
  requestId: string;
  createdAt: string;
}

export const inventoryService = {
  async getEntries(params?: {
    productId?: string;
    branchId?: string;
    providerId?: string;
    destination?: "branch" | "warehouse";
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    entries: InventoryEntry[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get("/inventory/entries", { params });
    return response.data;
  },

  async createEntry(payload: {
    product: string;
    quantity: number;
    unitCost?: number;
    branch?: string;
    provider?: string;
    notes?: string;
    purchaseGroupId?: string; // ⭐ Campo para agrupar recepciones
  }): Promise<{
    entry: InventoryEntry;
    product: { totalStock: number; warehouseStock: number };
  }> {
    const response = await api.post("/inventory/entry", payload);
    return response.data;
  },

  // Alias para compatibilidad
  addEntry(payload: {
    product: string;
    quantity: number;
    unitCost?: number;
    branch?: string;
    provider?: string;
    notes?: string;
    purchaseGroupId?: string;
  }): Promise<{
    entry: InventoryEntry;
    product: { totalStock: number; warehouseStock: number };
  }> {
    return this.createEntry(payload);
  },

  async getProductHistory(
    productId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    entries: InventoryEntry[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get(`/inventory/product/${productId}/history`, {
      params,
    });
    return response.data;
  },

  async getSummary(params?: { startDate?: string; endDate?: string }): Promise<{
    totalEntries: number;
    totalUnits: number;
    byDestination: { warehouse: number; branch: number };
    byProvider: Array<{ provider: string; count: number; units: number }>;
  }> {
    const response = await api.get("/inventory/summary", { params });
    return response.data;
  },

  async updateEntry(
    id: string,
    payload: {
      notes?: string;
      provider?: string | null;
    }
  ): Promise<{ entry: InventoryEntry }> {
    const response = await api.put(`/inventory/entry/${id}`, payload);
    return response.data;
  },

  async deleteEntry(id: string): Promise<{
    message: string;
    revertedQuantity: number;
    destination: string;
  }> {
    const response = await api.delete(`/inventory/entry/${id}`);
    return response.data;
  },
};

// ==================== PAYMENT METHOD SERVICE ====================
export interface PaymentMethod {
  _id: string;
  business: string;
  name: string;
  code: string;
  description?: string;
  isCredit: boolean;
  requiresConfirmation: boolean;
  requiresProof: boolean;
  icon?: string;
  color?: string;
  isActive: boolean;
  displayOrder: number;
  isSystem: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const paymentMethodService = {
  async getAll(): Promise<{ paymentMethods: PaymentMethod[] }> {
    const response = await api.get("/payment-methods");
    // El backend devuelve array directo, lo envolvemos en objeto
    return { paymentMethods: response.data };
  },

  async getById(id: string): Promise<{ paymentMethod: PaymentMethod }> {
    const response = await api.get(`/payment-methods/${id}`);
    return response.data;
  },

  async create(payload: {
    name: string;
    description?: string;
    isCredit?: boolean;
    requiresConfirmation?: boolean;
    requiresProof?: boolean;
    icon?: string;
    color?: string;
  }): Promise<{ paymentMethod: PaymentMethod }> {
    const response = await api.post("/payment-methods", payload);
    return response.data;
  },

  async update(
    id: string,
    payload: {
      name?: string;
      description?: string;
      isCredit?: boolean;
      requiresConfirmation?: boolean;
      requiresProof?: boolean;
      icon?: string;
      color?: string;
      isActive?: boolean;
    }
  ): Promise<{ paymentMethod: PaymentMethod }> {
    const response = await api.put(`/payment-methods/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/payment-methods/${id}`);
    return response.data;
  },

  async reorder(
    orderedIds: string[]
  ): Promise<{ message: string; paymentMethods: PaymentMethod[] }> {
    const response = await api.put("/payment-methods/reorder", { orderedIds });
    return response.data;
  },

  async initializeDefaults(): Promise<{
    message: string;
    paymentMethods: PaymentMethod[];
  }> {
    const response = await api.post("/payment-methods/initialize");
    return response.data;
  },
};

// ==================== DELIVERY METHOD SERVICE ====================
export interface DeliveryMethod {
  _id: string;
  business: string;
  name: string;
  code: string;
  description?: string;
  defaultCost: number;
  hasVariableCost: boolean;
  requiresAddress: boolean;
  estimatedTime?: string;
  icon: string;
  color: string;
  isActive: boolean;
  displayOrder: number;
  isSystem: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const deliveryMethodService = {
  async getAll(): Promise<{ deliveryMethods: DeliveryMethod[] }> {
    const response = await api.get("/delivery-methods");
    return response.data;
  },

  async getById(id: string): Promise<{ deliveryMethod: DeliveryMethod }> {
    const response = await api.get(`/delivery-methods/${id}`);
    return response.data;
  },

  async create(payload: {
    name: string;
    description?: string;
    defaultCost?: number;
    hasVariableCost?: boolean;
    requiresAddress?: boolean;
    estimatedTime?: string;
    icon?: string;
    color?: string;
  }): Promise<{ deliveryMethod: DeliveryMethod }> {
    const response = await api.post("/delivery-methods", payload);
    return response.data;
  },

  async update(
    id: string,
    payload: {
      name?: string;
      description?: string;
      defaultCost?: number;
      hasVariableCost?: boolean;
      requiresAddress?: boolean;
      estimatedTime?: string;
      icon?: string;
      color?: string;
      isActive?: boolean;
    }
  ): Promise<{ deliveryMethod: DeliveryMethod }> {
    const response = await api.put(`/delivery-methods/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/delivery-methods/${id}`);
    return response.data;
  },

  async reorder(
    orderedIds: string[]
  ): Promise<{ message: string; deliveryMethods: DeliveryMethod[] }> {
    const response = await api.put("/delivery-methods/reorder", { orderedIds });
    return response.data;
  },

  async initializeDefaults(): Promise<{
    message: string;
    deliveryMethods: DeliveryMethod[];
  }> {
    const response = await api.post("/delivery-methods/initialize");
    return response.data;
  },
};

// ========== SERVICIOS DE ÓRDENES DE VENTA (CARRITO) ==========

export interface SaleOrderItem {
  productId: string;
  productName?: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  totalPrice?: number;
}

export interface SaleOrder {
  _id: string;
  orderId: string;
  business: string;
  customer?: {
    _id: string;
    name: string;
    phone?: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
      image?: string;
    };
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    totalPrice: number;
  }>;
  totalItems: number;
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
  paymentType: "cash" | "credit" | "mixed";
  paymentMethod?: string;
  paymentStatus: "pending" | "partial" | "paid";
  isConfirmed: boolean;
  confirmedAt?: string;
  credit?: {
    _id: string;
    status: string;
    remainingAmount: number;
  };
  branch?: {
    _id: string;
    name: string;
  };
  seller?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface SaleOrderStats {
  totalOrders: number;
  totalItems: number;
  totalRevenue: number;
  confirmedOrders: number;
  pendingOrders: number;
}

// ELIMINADO: saleOrderService y purchaseOrderService
// La funcionalidad de agrupación se implementa directamente en Sales e InventoryEntries

/*
export const saleOrderService = {
  async create(data: {
    items: SaleOrderItem[];
    customerId?: string;
    branchId?: string;
    paymentType?: "cash" | "credit" | "mixed";
    paymentMethodId?: string;
    creditDueDate?: string;
    initialPayment?: number;
    notes?: string;
    saleDate?: string;
  }): Promise<{
    message: string;
    order: SaleOrder;
    salesCreated: number;
    creditCreated?: boolean;
  }> {
    const response = await api.post("/sale-orders", data);
    return response.data;
  },

  async getAll(filters?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    branchId?: string;
    paymentStatus?: string;
    isConfirmed?: boolean;
    search?: string;
  }): Promise<{
    orders: SaleOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats: SaleOrderStats;
  }> {
    const response = await api.get("/sale-orders", { params: filters });
    return response.data;
  },

  async getById(id: string): Promise<{ order: SaleOrder }> {
    const response = await api.get(`/sale-orders/${id}`);
    return response.data;
  },

  async confirm(id: string): Promise<{
    message: string;
    order: SaleOrder;
    error?: string;
  }> {
    const response = await api.patch(`/sale-orders/${id}/confirm`);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
    salesDeleted: number;
    creditDeleted: boolean;
    stockRestored: number;
  }> {
    const response = await api.delete(`/sale-orders/${id}`);
    return response.data;
  },
};

// ========== SERVICIOS DE ÓRDENES DE COMPRA (RECEPCIÓN DE MERCANCÍA) ==========

export interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitCost?: number;
}

export interface PurchaseOrder {
  _id: string;
  orderId: string;
  business: string;
  provider?: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  providerName?: string;
  branch?: {
    _id: string;
    name: string;
  };
  destination: "warehouse" | "branch";
  items: Array<{
    product: {
      _id: string;
      name: string;
      image?: string;
    };
    productName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    previousStock: number;
    newStock: number;
    previousAverageCost: number;
    newAverageCost: number;
  }>;
  totalItems: number;
  totalQuantity: number;
  totalCost: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  receivedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  receivedAt: string;
  status: "recibido" | "parcial" | "cancelado";
  notes?: string;
  createdAt: string;
}

export interface PurchaseOrderStats {
  totalOrders: number;
  totalCost: number;
  totalQuantity: number;
  totalItems: number;
}

export const purchaseOrderService = {
  async create(data: {
    items: PurchaseOrderItem[];
    providerId?: string;
    branchId?: string;
    notes?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
  }): Promise<{
    message: string;
    order: PurchaseOrder;
    entriesCreated: number;
    costInfo: {
      totalCost: number;
      averageCostUpdates: Array<{
        productId: string;
        productName: string;
        previousAverageCost: number;
        newAverageCost: number;
        stockBefore: number;
        stockAfter: number;
      }>;
    };
  }> {
    const response = await api.post("/purchase-orders", data);
    return response.data;
  },

  async getAll(filters?: {
    page?: number;
    limit?: number;
    providerId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{
    orders: PurchaseOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats: PurchaseOrderStats;
  }> {
    const response = await api.get("/purchase-orders", { params: filters });
    return response.data;
  },

  async getById(id: string): Promise<{ order: PurchaseOrder }> {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
    itemsReverted: number;
  }> {
    const response = await api.delete(`/purchase-orders/${id}`);
    return response.data;
  },
};
*/
