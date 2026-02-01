/**
 * Credit Services
 * Extracted from monolithic api/services.ts
 * Handles credit/debt operations
 */

import api from "../../../api/axios";
import type { Credit, CreditPayment } from "../../../types";

export const creditService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
    customerId?: string;
    distributorId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    credits: Credit[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats?: {
      totalCredits: number;
      totalDebt: number;
      overdue: number;
      overdueAmount: number;
    };
  }> {
    const response = await api.get("/credits", { params });
    return response.data;
  },

  async getById(id: string): Promise<{
    credit: Credit;
    payments: CreditPayment[];
  }> {
    const response = await api.get(`/credits/${id}`);
    return response.data;
  },

  async create(data: {
    customerId: string;
    saleId?: string;
    amount: number;
    dueDate: string;
    notes?: string;
    initialPayment?: number;
  }): Promise<{
    message: string;
    credit: Credit;
  }> {
    const response = await api.post("/credits", data);
    return response.data;
  },

  async registerPayment(
    creditId: string,
    data: {
      amount: number;
      paymentMethodId?: string;
      notes?: string;
      paymentProof?: string;
      paymentProofMimeType?: string;
    }
  ): Promise<{
    message: string;
    credit: Credit;
    payment: CreditPayment;
    remainingBalance: number;
  }> {
    const response = await api.post(`/credits/${creditId}/payments`, data);
    return response.data;
  },

  async registerDistributorPayment(
    creditId: string,
    data: {
      amount: number;
      notes?: string;
    }
  ): Promise<{
    message: string;
    credit: Credit;
    payment: CreditPayment;
    remainingBalance: number;
  }> {
    const response = await api.post(
      `/credits/${creditId}/distributor-payments`,
      data
    );
    return response.data;
  },

  async getDistributorCredits(params?: {
    status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
    customerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    credits: Credit[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats?: {
      totalCredits: number;
      totalDebt: number;
      overdue: number;
    };
  }> {
    const response = await api.get("/credits/distributor", { params });
    return response.data;
  },

  async cancel(creditId: string): Promise<{
    message: string;
    credit: Credit;
  }> {
    const response = await api.put(`/credits/${creditId}/cancel`);
    return response.data;
  },

  async delete(creditId: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/credits/${creditId}`);
    return response.data;
  },

  async getMetrics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }): Promise<{
    metrics: {
      totalCredits: number;
      totalAmount: number;
      totalPaid: number;
      totalPending: number;
      overdueAmount: number;
      averagePaymentTime: number;
      collectionRate: number;
    };
    timeline?: Array<{
      date: string;
      created: number;
      paid: number;
      amount: number;
    }>;
  }> {
    const response = await api.get("/credits/metrics", { params });
    return response.data;
  },

  async getCustomerCredits(
    customerId: string,
    params?: {
      status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
      page?: number;
      limit?: number;
    }
  ): Promise<{
    credits: Credit[];
    stats: {
      totalCredits: number;
      totalDebt: number;
      totalPaid: number;
    };
  }> {
    const response = await api.get(`/customers/${customerId}/credits`, {
      params,
    });
    return response.data;
  },
};
