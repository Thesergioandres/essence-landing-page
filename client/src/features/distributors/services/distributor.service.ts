/**
 * Distributor Services
 * Extracted from monolithic api/services.ts
 * Handles distributor operations
 */

import api from "../../../api/axios";
import type { User } from "../../auth/types/auth.types";
import type { Distributor } from "../../business/types/business.types";

export const distributorService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    active?: boolean;
    businessId?: string;
  }): Promise<{
    data: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasMore: boolean;
    };
  }> {
    const response = await api.get("/distributors", { params });
    const apiResponse = response.data;

    // V2 API devuelve { success: true, data: {...} }
    const actualData = apiResponse.data || apiResponse;

    // Handle both array and paginated response formats
    if (Array.isArray(actualData)) {
      return {
        data: actualData,
        pagination: {
          page: 1,
          limit: actualData.length,
          total: actualData.length,
          pages: 1,
          hasMore: false,
        },
      };
    }
    return actualData;
  },

  async getById(id: string): Promise<{
    distributor: User;
  }> {
    const response = await api.get(`/distributors/${id}`);
    // V2 API returns { success: true, data: distributor }
    // Frontend expects { distributor: User }
    const apiResponse = response.data;
    return {
      distributor: apiResponse.data || apiResponse.distributor || apiResponse,
    };
  },

  async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
    routes?: string[];
  }): Promise<{
    message: string;
    distributor: Distributor;
    user: User;
    password: string;
  }> {
    const response = await api.post("/distributors", data);
    // V2 API devuelve { success: true, data: {...} }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      address: string;
      routes: string[];
    }>
  ): Promise<{
    message: string;
    distributor: Distributor;
  }> {
    const response = await api.put(`/distributors/${id}`, data);
    // V2 API devuelve { success: true, data: {...} }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async delete(id: string): Promise<{
    message: string;
    distributorNameSnapshot: string;
    returnedUnits: number;
    returnedProducts: number;
    affectedSales: number;
  }> {
    const response = await api.delete(`/distributors/${id}`);
    // V2 API devuelve { success: true, data: {...} }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async toggleActive(id: string): Promise<{
    message: string;
    distributor: User;
  }> {
    const response = await api.put(`/distributors/${id}/toggle-active`, null, {
      // Compatibilidad: si el backend aún no tiene esta ruta, caemos al update legacy.
      validateStatus: status =>
        (status >= 200 && status < 300) || status === 404,
    });

    if (response.status !== 404) {
      const apiResponse = response.data;
      return apiResponse.data || apiResponse;
    }

    const currentResponse = await api.get(`/distributors/${id}`);
    const currentApiResponse = currentResponse.data;
    const currentDistributor =
      currentApiResponse.data ||
      currentApiResponse.distributor ||
      currentApiResponse;

    const nextActive = currentDistributor?.active === false;
    const legacyResponse = await api.put(`/distributors/${id}`, {
      active: nextActive,
    });
    const legacyApiResponse = legacyResponse.data;
    const updatedDistributor = legacyApiResponse.data || legacyApiResponse;

    return {
      message: nextActive
        ? "Distribuidor activado correctamente"
        : "Distribuidor pausado correctamente",
      distributor: updatedDistributor,
    };
  },

  async getProfile(): Promise<{
    distributor: Distributor;
    stats: {
      totalSales: number;
      totalProducts: number;
      revenue: number;
    };
  }> {
    const response = await api.get("/distributors/me/profile");
    // V2 API devuelve { success: true, data: { distributor, stats } }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async getProducts(distributorId?: string): Promise<{
    products: Array<{
      product: {
        _id: string;
        name: string;
        description?: string;
        mainImage?: {
          url: string;
          thumbnailUrl?: string;
        };
        category?: {
          _id: string;
          name: string;
        };
        basePrice: number;
        purchasePrice?: number;
        averageCost?: number;
        distributorPrice: number;
        clientPrice?: number;
        sku?: string;
        isActive: boolean;
      };
      quantity: number;
      lastRestock?: Date;
    }>;
    total: number;
  }> {
    const url = distributorId
      ? `/distributors/${distributorId}/products`
      : "/distributors/me/products";
    console.log("🔍 [distributorService.getProducts] URL:", url);
    const response = await api.get(url);
    console.log(
      "📦 [distributorService.getProducts] Raw response:",
      response.data
    );
    // V2 API devuelve { success: true, data: { products, total } }
    const apiResponse = response.data;
    const result = apiResponse.data || apiResponse;
    console.log("📦 [distributorService.getProducts] Parsed result:", result);
    return result;
  },

  async getPublicCatalog(distributorId: string): Promise<{
    products: Array<any>;
    distributor: {
      name: string;
      phone?: string;
      email?: string;
    } | null;
    business: {
      name?: string;
      logoUrl?: string | null;
    } | null;
  }> {
    const response = await api.get(`/distributors/${distributorId}/catalog`);
    const payload = response.data?.data || response.data;

    return {
      products: payload?.products || response.data?.products || [],
      distributor: payload?.distributor || response.data?.distributor || null,
      business: payload?.business || response.data?.business || null,
    };
  },
};
