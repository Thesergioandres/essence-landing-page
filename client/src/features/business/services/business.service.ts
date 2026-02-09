/**
 * Business Services
 * Extracted from monolithic api/services.ts
 * Handles business management and AI assistant
 */

import api from "../../../api/axios";
import type { User } from "../../auth/types/auth.types";
import type {
  Business,
  BusinessAssistantActionType,
  BusinessAssistantRecommendationsResponse,
  BusinessMembership,
} from "../types/business.types";

// ==================== BUSINESS SERVICE ====================
export const businessService = {
  async create(data: {
    name: string;
    description?: string;
    type:
      | "retail"
      | "wholesale"
      | "manufacturing"
      | "services"
      | "distribution"
      | "ecommerce";
    size: "micro" | "small" | "medium" | "large";
    industry?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
    currency?: string;
    timezone?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactLocation?: string;
    logoUrl?: string;
    logoPublicId?: string;
    logo?: {
      url: string;
      thumbnailUrl?: string;
    };
  }): Promise<{
    message: string;
    business: Business;
    membership: BusinessMembership;
  }> {
    const response = await api.post("/business", data);
    const payload = response.data as {
      message?: string;
      business?: Business;
      membership?: BusinessMembership;
      data?:
        | Business
        | { business?: Business; membership?: BusinessMembership };
    };

    if (payload.business) {
      return {
        message: payload.message || "Negocio creado",
        business: payload.business,
        membership: payload.membership as BusinessMembership,
      };
    }

    const dataPayload = payload.data as
      | Business
      | { business?: Business; membership?: BusinessMembership }
      | undefined;

    const business =
      (dataPayload as { business?: Business } | undefined)?.business ||
      (dataPayload as Business | undefined);

    return {
      message: payload.message || "Negocio creado",
      business: business as Business,
      membership: (
        dataPayload as { membership?: BusinessMembership } | undefined
      )?.membership as BusinessMembership,
    };
  },

  async getMyMemberships(): Promise<{
    memberships: Array<
      BusinessMembership & {
        business: Business;
      }
    >;
    activeMembership?: BusinessMembership & {
      business: Business;
    };
  }> {
    const response = await api.get<{
      success: boolean;
      data: {
        memberships: (BusinessMembership & { business: Business })[];
        activeMembership?: BusinessMembership & { business: Business };
      };
    }>("/business/my-memberships");
    return response.data.data;
  },

  async updateBusiness(
    businessId: string,
    data: Partial<{
      name: string;
      description: string;
      type: string;
      size: string;
      industry: string;
      address: string;
      phone: string;
      email: string;
      website: string;
      taxId: string;
      currency: string;
      timezone: string;
      contactEmail: string;
      contactPhone: string;
      contactWhatsapp: string;
      contactLocation: string;
      logo: { url: string; thumbnailUrl?: string };
      logoUrl: string;
      logoPublicId: string;
    }>
  ): Promise<{
    message: string;
    business: Business;
  }> {
    const response = await api.put(`/business/${businessId}`, data);
    return response.data;
  },

  async updateBusinessFeatures(
    businessId: string,
    features: Partial<Record<string, boolean>>
  ): Promise<{
    message: string;
    business: Business;
  }> {
    const response = await api.put(`/business/${businessId}/features`, {
      features,
    });
    return response.data;
  },

  async listMembers(businessId: string): Promise<{
    members: Array<{
      user: User;
      role: "owner" | "admin" | "manager" | "distributor" | "viewer";
      permissions: string[];
      branches: string[];
      joinedAt: Date;
      invitedBy?: User;
    }>;
    pendingInvites: Array<{
      email: string;
      role: string;
      expiresAt: Date;
      invitedBy: User;
    }>;
  }> {
    const response = await api.get(`/business/${businessId}/members`);
    // V2 API devuelve { success: true, data: { members, pendingInvites } } O a veces solo data: [members]
    const apiResponse = response.data;

    const rawData = apiResponse.data || apiResponse;

    if (Array.isArray(rawData)) {
      return {
        members: rawData,
        pendingInvites: [],
      };
    }

    return rawData;
  },

  async updateMemberBranches(
    businessId: string,
    membershipId: string,
    branches: string[]
  ): Promise<{
    message: string;
    membership: BusinessMembership;
  }> {
    const response = await api.put(
      `/business/${businessId}/members/${membershipId}`,
      { allowedBranches: branches }
    );
    return response.data;
  },

  async addMember(
    businessId: string,
    data: {
      email?: string;
      userId?: string;
      role: "admin" | "manager" | "distributor" | "viewer";
      permissions?: string[];
      branches?: string[];
    }
  ): Promise<{
    message: string;
    invite?: {
      email: string;
      expiresAt: Date;
    };
    membership?: BusinessMembership;
  }> {
    const response = await api.post(`/business/${businessId}/members`, data);
    return response.data;
  },

  async updateMemberPermissions(
    businessId: string,
    userId: string,
    data: {
      role?: "admin" | "manager" | "distributor" | "viewer";
      permissions?: string[];
      branches?: string[];
    }
  ): Promise<{
    message: string;
    membership: BusinessMembership;
  }> {
    const response = await api.put(
      `/business/${businessId}/members/${userId}`,
      data
    );
    return response.data;
  },

  async removeMember(
    businessId: string,
    userId: string
  ): Promise<{
    message: string;
  }> {
    const response = await api.delete(
      `/business/${businessId}/members/${userId}`
    );
    return response.data;
  },

  async getBusinessSettings(businessId: string): Promise<{
    settings: {
      lowStockThreshold: number;
      criticalStockThreshold: number;
      defaultPaymentTerms: number;
      defaultWarrantyDays: number;
      enableEmailNotifications: boolean;
      enablePushNotifications: boolean;
      autoConfirmPayments: boolean;
    };
  }> {
    const response = await api.get(`/business/${businessId}/settings`);
    return response.data;
  },

  async updateBusinessSettings(
    businessId: string,
    settings: Partial<{
      lowStockThreshold: number;
      criticalStockThreshold: number;
      defaultPaymentTerms: number;
      defaultWarrantyDays: number;
      enableEmailNotifications: boolean;
      enablePushNotifications: boolean;
      autoConfirmPayments: boolean;
    }>
  ): Promise<{
    message: string;
    settings: Record<string, any>;
  }> {
    const response = await api.put(`/business/${businessId}/settings`, {
      settings,
    });
    return response.data;
  },
};

// ==================== BUSINESS ASSISTANT SERVICE ====================
export const businessAssistantService = {
  normalizeResponse<T>(response: {
    data: T | { success?: boolean; data?: T };
  }) {
    const payload = response?.data as any;
    return payload?.data ?? payload;
  },
  mapLegacyRecommendations(payload: any) {
    if (
      !payload?.recommendations ||
      payload?.recommendations?.[0]?.recommendation
    ) {
      return payload;
    }

    const mapAction = (action: string): BusinessAssistantActionType => {
      switch (action) {
        case "buy_more_inventory":
        case "pause_purchases":
        case "decrease_price":
        case "increase_price":
        case "run_promotion":
        case "review_margin":
        case "clearance":
        case "keep":
          return action;
        case "adjust_price":
          return "increase_price";
        default:
          return "keep";
      }
    };

    const mapCategory = (type: string | undefined) => {
      switch (type) {
        case "inventory":
          return "inventario";
        case "pricing":
          return "precio";
        default:
          return "operacion";
      }
    };

    const mapConfidence = (priority: string | undefined) => {
      switch (priority) {
        case "high":
          return 0.9;
        case "medium":
          return 0.7;
        case "low":
        default:
          return 0.5;
      }
    };

    const horizonDays = payload?.metadata?.horizonDays ?? null;
    const recentDays = payload?.metadata?.recentDays ?? 0;
    const generatedAt =
      payload?.metadata?.generatedAt || new Date().toISOString();

    return {
      generatedAt,
      window: {
        horizonDays,
        recentDays,
        startDate: null,
        endDate: null,
      },
      recommendations: payload.recommendations.map((item: any) => {
        const action = mapAction(item.action);
        return {
          productId: item.productId || item.product?._id || "",
          productName: item.productName || item.title || "Producto",
          categoryId: null,
          categoryName: null,
          abcClass: "C",
          stock: {
            warehouseStock: item.stock ?? 0,
            totalStock: item.stock ?? 0,
            lowStockAlert: 0,
          },
          metrics: {
            recentDays,
            horizonDays,
            recentUnits: 0,
            prevUnits: 0,
            unitsGrowthPct: 0,
            recentRevenue: 0,
            recentProfit: 0,
            recentMarginPct: 0,
            avgDailyUnits: 0,
            daysCover: null,
            recentAvgPrice: 0,
            categoryAvgPrice: 0,
            priceVsCategoryPct: 0,
          },
          recommendation: {
            primary: {
              action,
              title: item.title || action,
              confidence: mapConfidence(item.priority),
              category: mapCategory(item.type),
            },
            actions: [],
            justification: item.reason ? [item.reason] : [],
            score: { impactScore: 0 },
            notes: item.reason,
          },
        };
      }),
      promotions: payload.promotions || [],
    } as BusinessAssistantRecommendationsResponse;
  },
  async getRecommendations(): Promise<{
    recommendations: Array<{
      _id: string;
      type:
        | "restock"
        | "promotion"
        | "pricing"
        | "customer"
        | "inventory"
        | "sales";
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      data?: Record<string, any>;
      actions?: Array<{
        label: string;
        action: string;
        params?: Record<string, any>;
      }>;
      expiresAt?: Date;
      createdAt: Date;
    }>;
    summary: {
      total: number;
      highPriority: number;
      byType: Record<string, number>;
    };
  }> {
    const response = await api.get("/business-assistant/recommendations");
    const payload = businessAssistantService.normalizeResponse(response);
    return businessAssistantService.mapLegacyRecommendations(payload);
  },

  async getConfig(): Promise<{
    config: {
      enabled: boolean;
      analysisFrequency: "daily" | "weekly" | "monthly";
      enabledRecommendations: string[];
      thresholds: {
        lowStockDays: number;
        slowMovingDays: number;
        profitMarginAlert: number;
      };
    };
  }> {
    const response = await api.get("/business-assistant/config");
    return businessAssistantService.normalizeResponse(response);
  },

  async updateConfig(config: {
    enabled?: boolean;
    analysisFrequency?: "daily" | "weekly" | "monthly";
    enabledRecommendations?: string[];
    thresholds?: {
      lowStockDays?: number;
      slowMovingDays?: number;
      profitMarginAlert?: number;
    };
  }): Promise<{
    message: string;
    config: Record<string, any>;
  }> {
    const response = await api.put("/business-assistant/config", config);
    return businessAssistantService.normalizeResponse(response);
  },

  async createRecommendationsJob(): Promise<{
    message: string;
    jobId: string;
  }> {
    const response = await api.post(
      "/business-assistant/recommendations/generate"
    );
    return businessAssistantService.normalizeResponse(response);
  },

  async getRecommendationsJob(jobId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: any;
    error?: string;
  }> {
    const response = await api.get(
      `/business-assistant/recommendations/job/${jobId}`
    );
    const payload = businessAssistantService.normalizeResponse(response);
    if (payload?.status === "completed" && payload?.result) {
      return {
        ...payload,
        result: businessAssistantService.mapLegacyRecommendations(
          payload.result
        ),
      };
    }
    return payload;
  },

  async getStrategicAnalysis(): Promise<{
    analysis: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
      keyMetrics: {
        healthScore: number;
        growthRate: number;
        profitTrend: "up" | "down" | "stable";
        customerSatisfaction?: number;
      };
      recommendations: string[];
    };
    generatedAt: Date;
  }> {
    const response = await api.get("/business-assistant/strategic-analysis");
    return businessAssistantService.normalizeResponse(response);
  },

  async getLatestAnalysis(): Promise<{
    analysis: {
      id: string;
      type: string;
      data: Record<string, any>;
      insights: string[];
      createdAt: Date;
    };
  }> {
    const response = await api.get("/business-assistant/analysis/latest");
    return businessAssistantService.normalizeResponse(response);
  },
};
