/**
 * Customer Services
 * Extracted from monolithic api/services.ts
 * Handles customer operations
 */

import api from "../../../api/axios";
import type { Sale } from "../../sales/types/sales.types";
import type { Customer } from "../types/customer.types";

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
    // Backend V2 retorna { success: true, data: customers[], pagination }
    // Normalizar al formato esperado por el frontend
    if (response.data.success && response.data.data) {
      return {
        customers: response.data.data,
        pagination: response.data.pagination,
      };
    }
    // Fallback para compatibilidad con respuesta antigua
    return response.data;
  },

  async getById(id: string): Promise<Customer> {
    const response = await api.get(`/customers/${id}`);
    // Backend V2 retorna { success: true, data: customer }
    return response.data.data || response.data;
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
    // Backend V2 returns { success: true, data: customer }
    // Frontend expects { message: string, customer: Customer }
    return {
      message: "Cliente creado correctamente",
      customer: response.data.data || response.data,
    };
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
    // Backend V2 retorna { success: true, data: customer }
    return {
      message: "Cliente actualizado correctamente",
      customer: response.data.data || response.data,
    };
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

  async update(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<{
    message: string;
    segment: { _id: string; name: string; description?: string };
  }> {
    const response = await api.put(`/customers/segments/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/customers/segments/${id}`);
    return response.data;
  },
};

// ==================== CUSTOMER POINTS SERVICE ====================
export const customerPointsService = {
  async getCustomerPoints(customerId: string): Promise<{
    customerId: string;
    name?: string;
    currentPoints: number;
    totalEarned: number;
    totalRedeemed: number;
    pointValue: number;
    monetaryValue: number;
  }> {
    const response = await api.get(`/customers/${customerId}/points`);
    const payload = response.data?.data || response.data;

    return {
      customerId: payload?.customerId || customerId,
      name: payload?.name,
      currentPoints: Number(payload?.currentPoints || 0),
      totalEarned: Number(payload?.totalEarned || 0),
      totalRedeemed: Number(payload?.totalRedeemed || 0),
      pointValue: Number(payload?.pointValue || 0),
      monetaryValue: Number(payload?.monetaryValue || 0),
    };
  },

  async getCustomerPointsHistory(
    customerId: string,
    params?: { limit?: number; skip?: number }
  ): Promise<{
    history: Array<{
      type: "earned" | "redeemed" | "bonus" | "adjustment" | "expired";
      amount: number;
      balance: number;
      description: string;
      createdAt: string;
    }>;
    totalRecords: number;
  }> {
    const response = await api.get(`/customers/${customerId}/points/history`, {
      params,
    });
    const payload = response.data?.data || response.data;

    return {
      history: Array.isArray(payload?.records)
        ? payload.records
        : Array.isArray(payload?.history)
          ? payload.history
          : [],
      totalRecords: Number(payload?.totalRecords || payload?.total || 0),
    };
  },

  async adjustCustomerPoints(
    customerId: string,
    data: { amount: number; description: string }
  ): Promise<{
    customerId: string;
    previousPoints: number;
    adjustment: number;
    newBalance: number;
  }> {
    const response = await api.post(`/customers/${customerId}/points/adjust`, {
      amount: data.amount,
      description: data.description,
      // Compatibilidad hacia atrás con payload legacy
      points: data.amount,
      reason: data.description,
    });

    return response.data?.data || response.data;
  },

  async validateCustomerRedemption(
    customerId: string,
    data: { pointsToRedeem: number; saleTotal?: number }
  ): Promise<{
    valid: boolean;
    errors: string[];
    redemptionValue: number;
    customerPoints: number;
  }> {
    const response = await api.post(
      `/customers/${customerId}/points/validate-redemption`,
      {
        pointsToRedeem: data.pointsToRedeem,
        // Compatibilidad hacia atrás con payload legacy
        points: data.pointsToRedeem,
        saleTotal: data.saleTotal,
      }
    );

    const payload = response.data?.data || response.data;
    const valid = payload?.valid === true;

    return {
      valid,
      errors: valid
        ? []
        : Array.isArray(payload?.errors)
          ? payload.errors
          : [payload?.message || "No se pudo validar la redención"],
      redemptionValue: Number(
        payload?.redemptionValue || data.pointsToRedeem * 0.01 || 0
      ),
      customerPoints: Number(
        payload?.customerPoints || payload?.currentPoints || 0
      ),
    };
  },

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
