/**
 * Sales Services
 * Extracted from monolithic api/services.ts
 * Handles sales operations, special sales, and defective products
 */

import api from "../../../api/axios";
import type {
  DefectiveProduct,
  Product,
  ProductImage,
} from "../../inventory/types/product.types";
import type { Sale, SaleStats } from "../types/sales.types";

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
    saleGroupId?: string;
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
    const response = await api.post("/sales", data);
    return response.data;
  },

  // Bulk order registration - accepts multiple items
  async registerBulk(data: {
    items: Array<{
      productId: string;
      promotionId?: string;
      quantity: number;
      salePrice: number;
      distributorPrice?: number;
      isPromotion?: boolean;
    }>;
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
      type: "supplier_replacement" | "total_loss";
      reason?: string;
    }>;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      saleGroupId: string;
      totalAmount: number;
      totalItems: number;
      netProfit: number;
      adminProfit: number;
    };
  }> {
    const response = await api.post("/sales", data);
    return response.data;
  },

  async registerStandardBulk(data: {
    items: Array<{
      productId: string;
      quantity: number;
      salePrice: number;
    }>;
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
    saleGroupId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      saleGroupId: string;
      totalAmount: number;
      totalItems: number;
      netProfit: number;
      adminProfit: number;
    };
  }> {
    const response = await api.post("/sales/standard", data);
    return response.data;
  },

  async registerPromotionBulk(data: {
    items: Array<{
      productId: string;
      promotionId: string;
      quantity: number;
      salePrice: number;
      isPromotion?: boolean;
    }>;
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
    saleGroupId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      saleGroupId: string;
      totalAmount: number;
      totalItems: number;
      netProfit: number;
      adminProfit: number;
    };
  }> {
    const response = await api.post("/sales/promotion", data);
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

  /**
   * Get all sales with pagination and filters
   * Source: server/src/infrastructure/http/controllers/ListSalesController.js
   * Response: { success, sales, stats, pagination }
   */
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
    success: boolean;
    sales: Sale[];
    stats: SaleStats;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number; // Alias de totalPages
      totalPages: number;
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

// ==================== SPECIAL SALE SERVICE ====================
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

// ==================== DEFECTIVE PRODUCT SERVICE ====================
export const defectiveProductService = {
  async getGlobalInventory(): Promise<{
    success: boolean;
    inventory: Array<{
      product: Product;
      warehouse: number;
      branches: number;
      distributors: number;
      total: number;
    }>;
  }> {
    const response = await api.get("/stock/global");
    return response.data;
  },

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
    hasWarranty?: boolean;
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
    hasWarranty?: boolean;
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
    const rawData = response.data;
    return rawData?.data || rawData?.reports || [];
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
    // Handle V2 response format: { success, data: reports[] }
    const rawData = response.data;
    return {
      reports: rawData?.data || rawData?.reports || [],
      stats: rawData?.stats || {
        total: 0,
        pendiente: 0,
        confirmado: 0,
        rechazado: 0,
        totalQuantity: 0,
      },
    };
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
    // Handle V2 response format: { success, stats }
    return {
      stats: response.data?.stats || response.data?.data || {},
    };
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
