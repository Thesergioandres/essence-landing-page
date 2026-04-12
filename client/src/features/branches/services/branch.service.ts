/**
 * Branch Services
 * Extracted from monolithic api/services.ts
 * Handles branch management and transfers
 */

import api from "../../../api/axios";
import type { Branch } from "../../business/types/business.types";
import type { Product } from "../../inventory/types/product.types";

// ==================== BRANCH SERVICE ====================
export const branchService = {
  async getAll(): Promise<Branch[]> {
    const response = await api.get<{ success: boolean; data: Branch[] }>(
      "/branches"
    );
    return response.data.data || [];
  },

  // Alias for getAll (backward compatibility)
  async list(): Promise<Branch[]> {
    return this.getAll();
  },

  async getById(id: string): Promise<Branch> {
    const response = await api.get<{ success: boolean; data: Branch }>(
      `/branches/${id}`
    );
    return response.data.data;
  },

  async create(data: {
    name: string;
    address?: string;
    phone?: string;
    manager?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    isMain?: boolean;
  }): Promise<{
    message: string;
    branch: Branch;
  }> {
    const response = await api.post("/branches", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      address: string;
      phone: string;
      manager: string;
      contactName: string;
      contactPhone: string;
      contactEmail: string;
      isMain: boolean;
      isActive: boolean;
      active: boolean;
    }>
  ): Promise<{
    message: string;
    branch: Branch;
  }> {
    const response = await api.put(`/branches/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/branches/${id}`);
    return response.data;
  },

  // Alias for delete (backward compatibility)
  async remove(id: string): Promise<{
    message: string;
  }> {
    return this.delete(id);
  },

  async getStock(
    branchId: string,
    params?: {
      categoryId?: string;
      lowStock?: boolean;
      search?: string;
    }
  ): Promise<{
    stock: Array<{
      product: Product;
      quantity: number;
      minStock?: number;
      lastRestock?: Date;
    }>;
    stats: {
      totalProducts: number;
      totalValue: number;
      lowStockCount: number;
    };
  }> {
    const response = await api.get(`/stock/branch/${branchId}`, { params });
    const payload = response.data?.data ?? response.data;
    if (Array.isArray(payload)) {
      return {
        stock: payload,
        stats: {
          totalProducts: payload.length,
          totalValue: 0,
          lowStockCount: 0,
        },
      };
    }
    return payload;
  },

  // Alias for getStock (backward compatibility)
  async getBranchStock(
    branchId: string,
    params?: {
      categoryId?: string;
      lowStock?: boolean;
      search?: string;
    }
  ) {
    return this.getStock(branchId, params);
  },

  async updateStock(
    branchId: string,
    productId: string,
    data: {
      quantity: number;
      reason?: string;
      type: "add" | "remove" | "set";
    }
  ): Promise<{
    message: string;
    newQuantity: number;
  }> {
    const response = await api.put(
      `/stock/branch/${branchId}/${productId}`,
      data
    );
    return response.data;
  },

  async getTransferHistory(
    branchId: string,
    params?: {
      page?: number;
      limit?: number;
      type?: "incoming" | "outgoing";
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    transfers: Array<{
      _id: string;
      type: "incoming" | "outgoing";
      product: Product;
      quantity: number;
      fromBranch?: Branch;
      toBranch?: Branch;
      fromEmployee?: { _id: string; name: string };
      toEmployee?: { _id: string; name: string };
      reason?: string;
      createdBy: { _id: string; name: string };
      createdAt: Date;
    }>;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const response = await api.get(`/branches/${branchId}/transfers`, {
      params,
    });
    return response.data;
  },

  async getSalesReport(
    branchId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      groupBy?: "day" | "week" | "month";
    }
  ): Promise<{
    sales: Array<{
      date: string;
      count: number;
      revenue: number;
      profit: number;
    }>;
    totals: {
      count: number;
      revenue: number;
      profit: number;
    };
    topProducts: Array<{
      product: Product;
      quantity: number;
      revenue: number;
    }>;
  }> {
    const response = await api.get(`/branches/${branchId}/sales-report`, {
      params,
    });
    return response.data;
  },

  async assignProducts(
    branchId: string,
    products: Array<{ productId: string; quantity: number }>
  ): Promise<{
    message: string;
    assigned: number;
  }> {
    const response = await api.post(`/branches/${branchId}/assign-products`, {
      products,
    });
    return response.data;
  },
};

// ==================== BRANCH TRANSFER SERVICE ====================
export const branchTransferService = {
  async create(data: {
    originBranchId: string;
    targetBranchId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }) {
    const response = await api.post("/branch-transfers", data);
    return response.data;
  },

  async getHistory(params?: {
    page?: number;
    limit?: number;
    fromType?: string;
    toType?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    transfers: Array<{
      _id: string;
      fromType: string;
      fromId?: string;
      fromName?: string;
      toType: string;
      toId?: string;
      toName?: string;
      product: Product;
      quantity: number;
      reason?: string;
      createdBy: { _id: string; name: string };
      createdAt: Date;
    }>;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const response = await api.get("/branch-transfers", { params });
    return response.data;
  },

  async getTransferById(transferId: string): Promise<{
    transfer: {
      _id: string;
      fromType: string;
      fromId?: string;
      fromName?: string;
      toType: string;
      toId?: string;
      toName?: string;
      product: Product;
      quantity: number;
      reason?: string;
      createdBy: { _id: string; name: string };
      createdAt: Date;
    };
  }> {
    const response = await api.get(`/branch-transfers/${transferId}`);
    return response.data;
  },

  async bulkTransfer(data: {
    fromType: "warehouse" | "branch" | "employee";
    fromId?: string;
    toType: "warehouse" | "branch" | "employee";
    toId?: string;
    products: Array<{ productId: string; quantity: number }>;
    reason?: string;
  }): Promise<{
    message: string;
    transfers: Array<{
      _id: string;
      productId: string;
      quantity: number;
    }>;
    totalTransferred: number;
  }> {
    const response = await api.post("/branch-transfers/bulk", data);
    return response.data;
  },
};
