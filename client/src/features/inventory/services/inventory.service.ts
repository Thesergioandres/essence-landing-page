/**
 * Inventory Services
 * Extracted from monolithic api/services.ts
 * Handles products, categories, stock, and inventory management
 */

import api from "../../../api/axios";
import { isContextReady } from "../../../shared/utils/contextGuard";
import { invalidateProductCache } from "../../../hooks";
import type {
  BranchStock,
  Category,
  EmployeeStock,
  InventoryEntry,
  Product,
  ProductHistoryEntry,
  ProductPayload,
  StockAlert,
} from "../types/product.types";

// ==================== PRODUCT SERVICE ====================
export const productService = {
  async getAll(
    filters: Record<string, string | boolean | number> = {}
  ): Promise<{
    data: Product[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasMore: boolean;
    };
  }> {
    if (!isContextReady()) return { data: [] };
    const response = await api.get("/products", { params: filters });
    if (response.data.data && response.data.pagination) {
      return response.data;
    }
    return {
      data: Array.isArray(response.data) ? response.data : [],
      pagination: undefined,
    };
  },

  async getPublicCatalog(
    filters: Record<string, string | boolean | number> = {}
  ): Promise<{
    data: Product[];
    business?: { _id?: string; name?: string; logoUrl?: string | null } | null;
  }> {
    if (!isContextReady()) return { data: [], business: null };
    const response = await api.get("/products/public", { params: filters });
    if (response.data?.success && Array.isArray(response.data?.data)) {
      return {
        data: response.data.data,
        business: response.data.business || null,
      };
    }
    return {
      data: Array.isArray(response.data) ? response.data : [],
      business: null,
    };
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    // Backend V2 returns { success: true, data: product }
    if ((response.data as any).success && (response.data as any).data) {
      return (response.data as any).data;
    }
    // Fallback for old format
    return response.data;
  },

  async getHistory(id: string): Promise<ProductHistoryEntry[]> {
    const response = await api.get(`/products/${id}/history`);
    if (response.data?.success && Array.isArray(response.data?.data)) {
      return response.data.data as ProductHistoryEntry[];
    }
    return Array.isArray(response.data) ? (response.data as any) : [];
  },

  async getAllCategories(): Promise<Category[]> {
    return categoryService.getAll();
  },

  async create(
    productData: ProductPayload & { imageFile?: File }
  ): Promise<Product> {
    const formData = new FormData();

    Object.entries(productData).forEach(([key, value]) => {
      if (key === "imageFile") return;
      if (key === "image") return;
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      }
    });

    if (productData.imageFile) {
      formData.append("image", productData.imageFile);
    }

    const response = await api.post<Product>("/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateProductCache();
    return response.data;
  },

  async update(
    id: string,
    productData: Partial<ProductPayload> & { imageFile?: File }
  ): Promise<Product> {
    const formData = new FormData();

    Object.entries(productData).forEach(([key, value]) => {
      if (key === "imageFile") return;
      if (key === "image") return;
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      }
    });

    if (productData.imageFile) {
      formData.append("image", productData.imageFile);
    }

    const response = await api.put<Product>(`/products/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateProductCache();
    return response.data;
  },

  async updatePrices(
    id: string,
    data: { price?: number; wholesalePrice?: number }
  ): Promise<Product> {
    const response = await api.patch(`/products/${id}/prices`, data);
    invalidateProductCache();
    if ((response.data as any)?.success && (response.data as any)?.data) {
      return (response.data as any).data as Product;
    }
    return response.data as Product;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/products/${id}`);
    invalidateProductCache();
    return response.data;
  },

  async getEmployeePrice(
    productId: string,
    employeeId: string
  ): Promise<{
    productId: string;
    employeeId: string;
    purchasePrice: number;
    employeePrice: number;
    profitPercentage: number;
    rankingPosition: number;
  }> {
    const response = await api.get(
      `/products/${productId}/employee-price/${employeeId}`
    );
    return response.data;
  },

  async getEmployeeProducts(): Promise<{ data: Product[] }> {
    const response = await api.get("/products/my-catalog");
    return {
      data: Array.isArray(response.data)
        ? response.data
        : response.data.data || [],
    };
  },

  async initializeAverageCost(): Promise<{
    message: string;
    updatedCount: number;
    updates: Array<{
      _id: string;
      name: string;
      purchasePrice: number;
      averageCost: number;
      totalStock: number;
      totalInventoryValue: number;
    }>;
  }> {
    const response = await api.post("/products/initialize-average-cost");
    return response.data;
  },

  async getBuyableCatalog(): Promise<{ message: string; data: any[] }> {
    const response = await api.get("/employees/catalog/buyable");
    return response.data;
  },

  async createEmployeeOrder(data: {
    items: Array<{ id: string; quantity: number; isPromotion: boolean }>;
    paymentMethodId?: string;
    paymentProof?: string;
  }): Promise<{ message: string; summary: any }> {
    const response = await api.post("/employees/orders", data);
    return response.data;
  },
};

// ==================== CATEGORY SERVICE ====================
export const categoryService = {
  async getAll(
    params?: Record<string, string | boolean | number>
  ): Promise<Category[]> {
    if (!isContextReady()) return [];
    const response = await api.get<{ success: boolean; data: Category[] }>(
      "/categories",
      { params }
    );
    return response.data.data;
  },

  async getById(id: string): Promise<Category> {
    const response = await api.get<{ success: boolean; data: Category }>(
      `/categories/${id}`
    );
    return response.data.data;
  },

  async create(data: {
    name: string;
    description?: string;
  }): Promise<Category> {
    const response = await api.post<{ success: boolean; data: Category }>(
      "/categories",
      data
    );
    return response.data.data;
  },

  async update(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Category> {
    const response = await api.put<{ success: boolean; data: Category }>(
      `/categories/${id}`,
      data
    );
    return response.data.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/categories/${id}`
    );
    return response.data;
  },
};

// ==================== STOCK SERVICE ====================
export const stockService = {
  async assignToEmployee(data: {
    employeeId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
    employeeStock: EmployeeStock;
    warehouseStock: number;
  }> {
    const response = await api.post("/stock/assign", data);
    return response.data;
  },

  async withdrawFromEmployee(data: {
    employeeId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
    employeeStock: EmployeeStock;
    warehouseStock: number;
  }> {
    const response = await api.post("/stock/withdraw", data);
    return response.data;
  },

  async getEmployeeStock(employeeId: string): Promise<EmployeeStock[]> {
    if (!isContextReady()) return [];
    const response = await api.get(`/stock/employee/${employeeId}`);

    let data: any[] = [];
    if (Array.isArray(response.data)) {
      data = response.data;
    } else {
      const payload = response.data as any;
      if (payload && Array.isArray(payload.data)) {
        data = payload.data;
      } else if (payload && Array.isArray(payload.stock)) {
        data = payload.stock;
      }
    }

    if (!data.length) return [];

    return data.map((item: any) => {
      if (
        item.product &&
        typeof item.product === "object" &&
        item.quantity !== undefined
      ) {
        return item as EmployeeStock;
      }
      if (
        item.name &&
        (item.employeeStock !== undefined || item.totalStock !== undefined)
      ) {
        return {
          _id: item._id || "generated-id",
          employee: employeeId,
          product: item,
          quantity: item.employeeStock ?? item.totalStock ?? 0,
          inTransitQuantity: item.inTransitQuantity ?? 0,
          lowStockAlert: item.lowStockAlert || 5,
          isLowStock: item.isLowStock,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        } as EmployeeStock;
      }
      return item as EmployeeStock;
    });
  },

  async getAllStock(): Promise<EmployeeStock[]> {
    if (!isContextReady()) return [];
    const response = await api.get<EmployeeStock[]>("/stock/all");
    return response.data;
  },

  async getBranchStock(branchId?: string): Promise<BranchStock[]> {
    if (!isContextReady()) return [];
    const url = branchId ? `/stock/branch/${branchId}` : "/stock/branch";
    const response = await api.get<{ data?: BranchStock[] } | BranchStock[]>(
      url
    );
    const payload = (response as any).data ?? response;
    if (Array.isArray(payload)) return payload as BranchStock[];
    return payload?.data ?? [];
  },

  async getAlerts(): Promise<StockAlert> {
    if (!isContextReady()) return { warehouseAlerts: [], employeeAlerts: [] };
    const response = await api.get<StockAlert>("/stock/alerts");
    return response.data;
  },

  async transferStock(data: {
    toEmployeeId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    success: boolean;
    message: string;
    transfer: {
      from: { employeeId: string; name: string; remainingStock: number };
      to: { employeeId: string; name: string; newStock: number };
      product: { id: string; name: string };
      quantity: number;
    };
  }> {
    const response = await api.post("/stock/transfer", data);
    return response.data;
  },

  async transferStockToBranch(data: {
    toBranchId: string;
    productId: string;
    quantity: number;
  }): Promise<{ message: string }> {
    const response = await api.post("/stock/transfer-to-branch", data);
    return response.data;
  },

  async getTransferHistory(params: {
    fromEmployee?: string;
    toEmployee?: string;
    product?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transfers: any[];
    pagination: { page: number; limit: number; total: number; pages: number };
    stats: { totalTransfers: number; totalQuantity: number };
  }> {
    try {
      if (!isContextReady()) return { transfers: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 }, stats: { totalTransfers: 0, totalQuantity: 0 } };
      const response = await api.get("/stock/transfers", { params });
      const transfers = response.data.transfers || response.data.data || [];
      return {
        transfers,
        pagination: response.data.pagination || {
          page: 1,
          limit: 20,
          total: transfers.length,
          pages: 1,
        },
        stats: response.data.stats || {
          totalTransfers: transfers.length,
          totalQuantity: 0,
        },
      };
    } catch (error: any) {
      // If endpoint doesn't exist or fails, return empty data
      console.warn(
        "[getTransferHistory] Endpoint not available:",
        error.message
      );
      return {
        transfers: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        stats: { totalTransfers: 0, totalQuantity: 0 },
      };
    }
  },

  async getMyAllowedBranches(): Promise<{
    branches: Array<{
      _id: string;
      name: string;
      address?: string;
      isWarehouse?: boolean;
      stock: Array<{
        product: {
          _id: string;
          name: string;
          image?: string;
          clientPrice?: number;
          employeePrice?: number;
        };
        quantity: number;
      }>;
      totalProducts: number;
      totalUnits: number;
    }>;
    message?: string;
  }> {
    if (!isContextReady()) return { branches: [] };
    const response = await api.get("/stock/my-allowed-branches");
    return response.data;
  },

  async getGlobalInventory(): Promise<{ success: boolean; inventory: any[] }> {
    if (!isContextReady()) return { success: true, inventory: [] };
    const response = await api.get("/stock/global");
    return {
      success: true,
      inventory: Array.isArray(response.data.inventory)
        ? response.data.inventory
        : [],
    };
  },

  async reconcileStock(
    productId: string
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.post("/stock/reconcile", { productId });
    return response.data;
  },

  async syncProductStock(
    productId: string
  ): Promise<{ success: boolean; message?: string; newTotal: number }> {
    const response = await api.post("/stock/sync", { productId });
    return response.data;
  },
};

// ==================== INVENTORY SERVICE ====================
export const inventoryService = {
  async getEntries(params?: {
    productId?: string;
    branchId?: string;
    providerId?: string;
    destination?: "branch" | "warehouse";
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    entries: InventoryEntry[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    if (!isContextReady()) return { entries: [] };
    const response = await api.get("/inventory/entries", { params });
    // Handle V2 response format: { success, data: { entries, pagination } }
    const data = response.data?.data || response.data;
    return {
      entries: data?.entries || [],
      pagination: data?.pagination,
    };
  },

  async createEntry(payload: {
    product: string;
    quantity: number;
    unitCost?: number;
    additionalCosts?: number;
    branch?: string;
    provider?: string;
    notes?: string;
    purchaseGroupId?: string;
  }): Promise<{
    entry: InventoryEntry;
    costInfo?: {
      previousAverageCost: number;
      newAverageCost: number;
      totalInventoryValue: number;
      additionalCostsTotal?: number;
    };
  }> {
    const response = await api.post("/inventory/entry", payload);
    return response.data?.data || response.data;
  },

  addEntry(payload: {
    product: string;
    quantity: number;
    unitCost?: number;
    additionalCosts?: number;
    branch?: string;
    provider?: string;
    notes?: string;
    purchaseGroupId?: string;
  }): Promise<{
    entry: InventoryEntry;
    costInfo?: {
      previousAverageCost: number;
      newAverageCost: number;
      totalInventoryValue: number;
      additionalCostsTotal?: number;
    };
  }> {
    return this.createEntry(payload);
  },

  async getProductHistory(
    productId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    entries: InventoryEntry[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await api.get(`/inventory/product/${productId}/history`, {
      params,
    });
    return response.data;
  },

  async getSummary(params?: { startDate?: string; endDate?: string }): Promise<{
    totalEntries: number;
    totalUnits: number;
    byDestination: { warehouse: number; branch: number };
    byProvider: Array<{ provider: string; count: number; units: number }>;
  }> {
    const response = await api.get("/inventory/summary", { params });
    return response.data;
  },

  async updateEntry(
    id: string,
    payload: { notes?: string; provider?: string | null }
  ): Promise<{ entry: InventoryEntry }> {
    const response = await api.put(`/inventory/entry/${id}`, payload);
    return response.data;
  },

  async deleteEntry(id: string): Promise<{
    message: string;
    revertedQuantity: number;
    destination: string;
  }> {
    const response = await api.delete(`/inventory/entry/${id}`);
    return response.data;
  },
};
