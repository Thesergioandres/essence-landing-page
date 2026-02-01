/**
 * Settings Services
 * Extracted from monolithic api/services.ts
 * Handles payment methods, delivery methods, promotions, and providers
 */

import api from "../../../api/axios";
import type { DeliveryMethod, PaymentMethod, Promotion } from "../../../types";

// ==================== PAYMENT METHOD SERVICE ====================
export const paymentMethodService = {
  async getAll(): Promise<PaymentMethod[]> {
    const response = await api.get("/payment-methods");
    return response.data;
  },

  async getById(id: string): Promise<PaymentMethod> {
    const response = await api.get(`/payment-methods/${id}`);
    return response.data;
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
    return response.data;
  },

  async getById(id: string): Promise<DeliveryMethod> {
    const response = await api.get(`/delivery-methods/${id}`);
    return response.data;
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
    type?: "percentage" | "fixed" | "bogo" | "bundle";
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
    return response.data;
  },

  async getById(id: string): Promise<Promotion> {
    const response = await api.get(`/promotions/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    type: "percentage" | "fixed" | "bogo" | "bundle";
    value: number;
    minPurchase?: number;
    maxDiscount?: number;
    startDate: string;
    endDate: string;
    applicableProducts?: string[];
    applicableCategories?: string[];
    code?: string;
    usageLimit?: number;
    perCustomerLimit?: number;
  }): Promise<{
    message: string;
    promotion: Promotion;
  }> {
    const response = await api.post("/promotions", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      type: "percentage" | "fixed" | "bogo" | "bundle";
      value: number;
      minPurchase: number;
      maxDiscount: number;
      startDate: string;
      endDate: string;
      applicableProducts: string[];
      applicableCategories: string[];
      code: string;
      usageLimit: number;
      perCustomerLimit: number;
      isActive: boolean;
    }>
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
};

// ==================== PROVIDER SERVICE ====================
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
    return response.data;
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
    return response.data;
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
    const response = await api.post("/providers", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      contactName: string;
      email: string;
      phone: string;
      address: string;
      taxId: string;
      categories: string[];
      notes: string;
      isActive: boolean;
    }>
  ): Promise<{
    message: string;
    provider: any;
  }> {
    const response = await api.put(`/providers/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/providers/${id}`);
    return response.data;
  },
};
