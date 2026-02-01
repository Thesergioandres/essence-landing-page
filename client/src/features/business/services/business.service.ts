/**
 * Business Services
 * Extracted from monolithic api/services.ts
 * Handles business management and AI assistant
 */

import api from "../../../api/axios";
import type { Business, BusinessMembership, User } from "../../../types";

// ==================== BUSINESS SERVICE ====================
export const businessService = {
  async create(data: {
    name: string;
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
    return response.data;
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
    const response = await api.get("/business/my-memberships");
    return response.data;
  },

  async updateBusiness(
    businessId: string,
    data: Partial<{
      name: string;
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
      logo: { url: string; thumbnailUrl?: string };
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
    features: Partial<{
      enableBranches: boolean;
      enableDistributors: boolean;
      enableCustomers: boolean;
      enableCredits: boolean;
      enablePromotions: boolean;
      enableNotifications: boolean;
      enableWarranties: boolean;
      enablePoints: boolean;
      enableAnalytics: boolean;
      enableAudit: boolean;
    }>
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
    return response.data;
  },

  async updateMemberBranches(
    businessId: string,
    userId: string,
    branches: string[]
  ): Promise<{
    message: string;
    membership: BusinessMembership;
  }> {
    const response = await api.put(
      `/business/${businessId}/members/${userId}/branches`,
      { branches }
    );
    return response.data;
  },

  async addMember(
    businessId: string,
    data: {
      email: string;
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
    return response.data;
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
    return response.data;
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
    return response.data;
  },

  async createRecommendationsJob(): Promise<{
    message: string;
    jobId: string;
  }> {
    const response = await api.post(
      "/business-assistant/recommendations/generate"
    );
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
  },
};
