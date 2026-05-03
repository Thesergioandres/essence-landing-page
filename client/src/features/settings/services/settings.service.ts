/**
 * Settings Services
 * Extracted from monolithic api/services.ts
 * Handles payment methods, delivery methods, promotions, and providers
 */

import api from "../../../api/axios";
import type { Promotion } from "../types/promotion.types";
import type { DeliveryMethod, PaymentMethod } from "../types/settings.types";

// ==================== PAYMENT METHOD SERVICE ====================
export const paymentMethodService = {
  async getAll(): Promise<PaymentMethod[]> {
    const response = await api.get("/payment-methods");
    return response.data.data || response.data;
  },

  async getById(id: string): Promise<PaymentMethod> {
    const response = await api.get(`/payment-methods/${id}`);
    return response.data.data || response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    icon?: string;
    isActive?: boolean;
    requiresProof?: boolean;
    processingFee?: number;
    processingFeeType?: "fixed" | "percentage";
  }): Promise<{
    message: string;
    paymentMethod: PaymentMethod;
  }> {
    const response = await api.post("/payment-methods", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      icon: string;
      isActive: boolean;
      requiresProof: boolean;
      processingFee: number;
      processingFeeType: "fixed" | "percentage";
    }>
  ): Promise<{
    message: string;
    paymentMethod: PaymentMethod;
  }> {
    const response = await api.put(`/payment-methods/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/payment-methods/${id}`);
    return response.data;
  },

  async reorder(orderedIds: string[]): Promise<{
    message: string;
  }> {
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
export const deliveryMethodService = {
  async getAll(): Promise<DeliveryMethod[]> {
    const response = await api.get("/delivery-methods");
    return response.data.data || response.data;
  },

  async getById(id: string): Promise<DeliveryMethod> {
    const response = await api.get(`/delivery-methods/${id}`);
    return response.data.data || response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    icon?: string;
    isActive?: boolean;
    requiresAddress?: boolean;
    defaultCost?: number;
    estimatedDays?: number;
  }): Promise<{
    message: string;
    deliveryMethod: DeliveryMethod;
  }> {
    const response = await api.post("/delivery-methods", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      icon: string;
      isActive: boolean;
      requiresAddress: boolean;
      defaultCost: number;
      estimatedDays: number;
    }>
  ): Promise<{
    message: string;
    deliveryMethod: DeliveryMethod;
  }> {
    const response = await api.put(`/delivery-methods/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/delivery-methods/${id}`);
    return response.data;
  },

  async reorder(orderedIds: string[]): Promise<{
    message: string;
  }> {
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

// ==================== PROMOTION SERVICE ====================
export const promotionService = {
  async getAll(params?: {
    status?: "active" | "scheduled" | "expired" | "disabled";
    type?:
      | "percentage"
      | "fixed"
      | "bogo"
      | "bundle"
      | "combo"
      | "volume"
      | "discount";
  }): Promise<{
    promotions: Promotion[];
    stats?: {
      active: number;
      scheduled: number;
      expired: number;
      totalDiscount: number;
    };
  }> {
    const response = await api.get("/promotions", { params });
    return {
      promotions:
        response.data?.data || response.data?.promotions || response.data || [],
      stats: response.data?.stats,
    };
  },

  async getPublicPromotions(params?: {
    businessId: string;
    status?: string;
  }): Promise<{
    promotions: Promotion[];
  }> {
    const response = await api.get("/promotions/public", { params });
    return {
      promotions:
        response.data?.data || response.data?.promotions || response.data || [],
    };
  },

  async getById(id: string): Promise<Promotion> {
    const response = await api.get(`/promotions/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    type:
      | "percentage"
      | "fixed"
      | "bogo"
      | "bundle"
      | "combo"
      | "volume"
      | "discount";
    value?: number;
    minPurchase?: number;
    maxDiscount?: number;
    startDate?: string;
    endDate?: string;
    applicableProducts?: string[];
    applicableCategories?: string[];
    code?: string;
    usageLimit?: number;
    perCustomerLimit?: number;
    [key: string]: any;
  }): Promise<{
    message: string;
    promotion: Promotion;
  }> {
    const response = await api.post("/promotions", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<Record<string, any>>
  ): Promise<{
    message: string;
    promotion: Promotion;
  }> {
    const response = await api.put(`/promotions/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/promotions/${id}`);
    return response.data;
  },

  async toggleActive(id: string): Promise<{
    message: string;
    promotion: Promotion;
  }> {
    const response = await api.put(`/promotions/${id}/toggle`);
    return response.data;
  },

  async validateCode(
    code: string,
    cartTotal?: number
  ): Promise<{
    valid: boolean;
    promotion?: Promotion;
    discount?: number;
    message?: string;
  }> {
    const response = await api.post("/promotions/validate-code", {
      code,
      cartTotal,
    });
    return response.data;
  },

  async getMetrics(): Promise<{
    totalRevenue: number;
    totalDiscount: number;
    usageCount: number;
    topPromotions: Array<{ _id: string; name: string; usageCount: number }>;
  }> {
    const response = await api.get("/promotions/metrics");
    return response.data;
  },

  async toggleStatus(id: string): Promise<{
    message: string;
    promotion: Promotion;
  }> {
    const response = await api.put(`/promotions/${id}/toggle-status`);
    const apiResponse = response.data;
    const promotion = apiResponse?.promotion || apiResponse?.data;
    return {
      message: apiResponse?.message,
      promotion,
    };
  },
};

// ==================== PROVIDER SERVICE ====================
const normalizeProvider = (provider: any) => {
  if (!provider || typeof provider !== "object") {
    return provider;
  }

  const resolvedPhone = provider.phone ?? provider.contactPhone ?? "";
  const resolvedEmail = provider.email ?? provider.contactEmail ?? "";
  const resolvedActive = provider.isActive ?? provider.active ?? true;

  return {
    ...provider,
    phone: resolvedPhone,
    email: resolvedEmail,
    isActive: Boolean(resolvedActive),
  };
};

const buildProviderPayload = (data: {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}) => {
  const { phone, email, isActive, ...rest } = data;

  return {
    ...rest,
    ...(phone !== undefined ? { contactPhone: phone } : {}),
    ...(email !== undefined ? { contactEmail: email } : {}),
    ...(isActive !== undefined ? { active: isActive } : {}),
  };
};

export const providerService = {
  async getAll(): Promise<{
    providers: Array<{
      _id: string;
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      taxId?: string;
      categories?: string[];
      notes?: string;
      isActive: boolean;
      createdAt: Date;
    }>;
  }> {
    const response = await api.get("/providers");
    const payload = response.data?.data || response.data?.providers || [];
    const providers = Array.isArray(payload)
      ? payload.map(normalizeProvider)
      : [];
    return { providers };
  },

  async getById(id: string): Promise<{
    _id: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
    categories?: string[];
    notes?: string;
    isActive: boolean;
    products?: Array<{
      productId: string;
      productName: string;
      lastPurchasePrice: number;
      lastPurchaseDate: Date;
    }>;
  }> {
    const response = await api.get(`/providers/${id}`);
    const payload = response.data?.data || response.data;
    return normalizeProvider(payload);
  },

  async create(data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
    categories?: string[];
    notes?: string;
  }): Promise<{
    message: string;
    provider: any;
  }> {
    const response = await api.post("/providers", buildProviderPayload(data));
    const provider = normalizeProvider(
      response.data?.data || response.data?.provider || response.data
    );

    return {
      message: response.data?.message || "Proveedor creado",
      provider,
    };
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      contactName: string;
      email: string;
      phone: string;
      address: string;
      notes: string;
      isActive: boolean;
    }>
  ): Promise<{
    message: string;
    provider: any;
  }> {
    const response = await api.put(
      `/providers/${id}`,
      buildProviderPayload(data)
    );
    const provider = normalizeProvider(
      response.data?.data || response.data?.provider || response.data
    );

    return {
      message: response.data?.message || "Proveedor actualizado",
      provider,
    };
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/providers/${id}`);
    return response.data;
  },
};
