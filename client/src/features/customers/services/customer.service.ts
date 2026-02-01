/**
 * Customer Services
 * Extracted from monolithic api/services.ts
 * Handles customer operations
 */

import api from "../../../api/axios";
import type { Customer, Sale } from "../../../types";

export const customerService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    hasDebt?: boolean;
  }): Promise<{
    customers: Customer[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats?: {
      total: number;
      withDebt: number;
      totalDebt: number;
    };
  }> {
    const response = await api.get("/customers", { params });
    return response.data;
  },

  async getById(id: string): Promise<Customer> {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    taxId?: string;
    segment?: string;
    birthday?: string;
    preferredContact?: "email" | "phone" | "whatsapp";
  }): Promise<{
    message: string;
    customer: Customer;
  }> {
    const response = await api.post("/customers", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      phone: string;
      address: string;
      notes: string;
      taxId: string;
      segment: string;
      birthday: string;
      preferredContact: "email" | "phone" | "whatsapp";
    }>
  ): Promise<{
    message: string;
    customer: Customer;
  }> {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  async getPurchaseHistory(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    sales: Sale[];
    stats: {
      totalPurchases: number;
      totalSpent: number;
      averagePurchase: number;
      lastPurchase?: Date;
    };
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const response = await api.get(`/customers/${customerId}/purchases`, {
      params,
    });
    return response.data;
  },

  async getWithDebt(): Promise<{
    customers: Array<
      Customer & {
        totalDebt: number;
        creditsCount: number;
        oldestCreditDate: Date;
      }
    >;
    totalDebt: number;
  }> {
    const response = await api.get("/customers/with-debt");
    return response.data;
  },
};

// ==================== SEGMENT SERVICE ====================
export const segmentService = {
  async getAll(): Promise<{
    segments: Array<{
      _id: string;
      name: string;
      description?: string;
      customerCount: number;
    }>;
  }> {
    const response = await api.get("/customers/segments");
    return response.data;
  },

  async create(data: { name: string; description?: string }): Promise<{
    message: string;
    segment: { _id: string; name: string; description?: string };
  }> {
    const response = await api.post("/customers/segments", data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/customers/segments/${id}`);
    return response.data;
  },
};

// ==================== CUSTOMER POINTS SERVICE ====================
export const customerPointsService = {
  async getBalance(customerId: string): Promise<{
    balance: number;
    history: Array<{
      type: "earned" | "redeemed" | "expired" | "adjusted";
      points: number;
      reason: string;
      date: Date;
    }>;
  }> {
    const response = await api.get(`/customers/${customerId}/points`);
    return response.data;
  },

  async addPoints(
    customerId: string,
    data: { points: number; reason: string }
  ): Promise<{
    message: string;
    newBalance: number;
  }> {
    const response = await api.post(`/customers/${customerId}/points`, data);
    return response.data;
  },

  async redeemPoints(
    customerId: string,
    data: { points: number; reason: string }
  ): Promise<{
    message: string;
    newBalance: number;
  }> {
    const response = await api.post(
      `/customers/${customerId}/points/redeem`,
      data
    );
    return response.data;
  },

  async getConfig(): Promise<{
    pointsPerCurrency: number;
    currencyPerPoint: number;
    minPointsToRedeem: number;
    expirationDays?: number;
  }> {
    const response = await api.get("/customers/points/config");
    return response.data;
  },
};
