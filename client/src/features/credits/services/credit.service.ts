/**
 * Credit Services
 * Extracted from monolithic api/services.ts
 * Handles credit/debt operations
 */

import api from "../../../api/axios";
import type { Credit, CreditPayment } from "../types/credit.types";

export const creditService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
    customerId?: string;
    employeeId?: string;
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
    // Handle V2 response format: { success, data: credits[], pagination }
    const rawData = response.data;
    return {
      credits: rawData?.data || rawData?.credits || [],
      pagination: rawData?.pagination,
      stats: rawData?.stats,
    };
  },

  async getById(id: string): Promise<{
    credit: Credit;
    payments: CreditPayment[];
    profitInfo: {
      // Información básica del crédito
      originalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      isPaidCompletely: boolean;
      // Información de la venta asociada
      saleId?: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
      totalSaleAmount: number;
      // Costos
      unitCost: number;
      totalCost: number;
      // Ganancias
      adminProfit: number;
      employeeProfit: number;
      totalProfit: number;
      employeeProfitPercentage: number;
      profitMarginPercentage: number;
      // Información del employee
      isEmployeeSale: boolean;
      employeeName?: string | null;
      employeeEmail?: string | null;
      // Estado de realización de la ganancia
      profitRealized: boolean;
      realizedProfit: number;
      pendingProfit: number;
    } | null;
  }> {
    const response = await api.get(`/credits/${id}`);
    // Handle V2 response format: { success, data: { credit, payments, profitInfo } }
    const rawData = response.data?.data || response.data;
    return {
      credit: rawData.credit,
      payments: rawData.payments || [],
      profitInfo: rawData.profitInfo || null,
    };
  },

  async create(data: {
    customerId: string;
    saleId?: string;
    amount: number;
    dueDate: string;
    notes?: string;
    initialPayment?: number;
  }): Promise<Credit> {
    const response = await api.post("/credits", data);
    // Handle V2 response format: { success, data: credit }
    return response.data?.data || response.data;
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
    message?: string;
    credit: Credit;
    payment: CreditPayment;
    remainingBalance: number;
  }> {
    const response = await api.post(`/credits/${creditId}/payments`, data);
    // Handle V2 response format: { success, data: { credit, payment, remainingBalance } }
    return response.data?.data || response.data;
  },

  async registerEmployeePayment(
    creditId: string,
    data: {
      amount: number;
      notes?: string;
    }
  ): Promise<{
    message?: string;
    credit: Credit;
    payment: CreditPayment;
    remainingBalance: number;
  }> {
    const response = await api.post(
      `/credits/${creditId}/employee-payments`,
      data
    );
    // Handle V2 response format: { success, data: { credit, payment, remainingBalance } }
    return response.data?.data || response.data;
  },

  async getEmployeeCredits(params?: {
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
    const response = await api.get("/credits/employee", { params });
    // Handle V2 response format: { success, data: credits[], pagination, stats }
    const rawData = response.data;
    return {
      credits: rawData?.data || rawData?.credits || [],
      pagination: rawData?.pagination,
      stats: rawData?.stats,
    };
  },

  async cancel(creditId: string): Promise<Credit> {
    const response = await api.put(`/credits/${creditId}/cancel`);
    // Handle V2 response format: { success, data: credit }
    return response.data?.data || response.data;
  },

  async delete(creditId: string): Promise<void> {
    await api.delete(`/credits/${creditId}`);
    // No return needed - just confirm deletion
  },

  async getMetrics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }): Promise<{
    total: {
      totalCredits: number;
      totalRemainingAmount: number;
      totalPaidAmount: number;
      overdueCount: number;
      overdueAmount: number;
    };
    overdue: {
      count: number;
      amount: number;
    };
    recoveryRate: number;
    topDebtors?: Array<{
      customerId: string;
      customerName: string;
      totalDebt: number;
      creditsCount: number;
    }>;
    timeline?: Array<{
      date: string;
      created: number;
      paid: number;
      amount: number;
    }>;
  }> {
    const response = await api.get("/credits/metrics", { params });
    // Handle V2 response format: { success, data: { pending, paid, overdue, totalOutstanding } }
    const rawData = response.data?.data || response.data;

    // Transform backend structure to frontend expected structure
    const pending = rawData?.pending || {
      count: 0,
      totalAmount: 0,
      totalPaid: 0,
    };
    const paid = rawData?.paid || { count: 0, totalAmount: 0, totalPaid: 0 };
    const overdue = rawData?.overdue || {
      count: 0,
      totalAmount: 0,
      totalPaid: 0,
    };

    const totalPaid = pending.totalPaid + paid.totalPaid + overdue.totalPaid;
    const totalAmount =
      pending.totalAmount + paid.totalAmount + overdue.totalAmount;
    const recoveryRate =
      totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

    return {
      total: {
        totalCredits: pending.count + paid.count + overdue.count,
        totalRemainingAmount: rawData?.totalOutstanding || 0,
        totalPaidAmount: totalPaid,
        overdueCount: overdue.count,
        overdueAmount: overdue.totalAmount - overdue.totalPaid,
      },
      overdue: {
        count: overdue.count,
        amount: overdue.totalAmount - overdue.totalPaid,
      },
      recoveryRate,
      topDebtors: rawData?.topDebtors || [],
      timeline: rawData?.timeline,
    };
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
    // Handle V2 response format: { success, data: { credits, stats } }
    const rawData = response.data?.data || response.data;
    return {
      credits: rawData?.credits || [],
      stats: rawData?.stats || { totalCredits: 0, totalDebt: 0, totalPaid: 0 },
    };
  },
};
