/**
 * Employee Services
 * Extracted from monolithic api/services.ts
 * Handles employee operations
 */

import api from "../../../api/axios";
import type { User } from "../../auth/types/auth.types";
import type { Employee } from "../../business/types/business.types";

export const employeeService = {
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
    const response = await api.get("/employees", { params });
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
    employee: User;
  }> {
    const response = await api.get(`/employees/${id}`);
    // V2 API returns { success: true, data: employee }
    // Frontend expects { employee: User }
    const apiResponse = response.data;
    return {
      employee: apiResponse.data || apiResponse.employee || apiResponse,
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
    employee: Employee;
    user: User;
    password: string;
  }> {
    const response = await api.post("/employees", data);
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
    employee: Employee;
  }> {
    const response = await api.put(`/employees/${id}`, data);
    // V2 API devuelve { success: true, data: {...} }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async delete(id: string): Promise<{
    message: string;
    employeeNameSnapshot: string;
    returnedUnits: number;
    returnedProducts: number;
    affectedSales: number;
  }> {
    const response = await api.delete(`/employees/${id}`);
    // V2 API devuelve { success: true, data: {...} }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async toggleActive(id: string): Promise<{
    message: string;
    employee: User;
  }> {
    const response = await api.put(`/employees/${id}/toggle-active`, null, {
      // Compatibilidad: si el backend aún no tiene esta ruta, caemos al update legacy.
      validateStatus: status =>
        (status >= 200 && status < 300) || status === 404,
    });

    if (response.status !== 404) {
      const apiResponse = response.data;
      return apiResponse.data || apiResponse;
    }

    const currentResponse = await api.get(`/employees/${id}`);
    const currentApiResponse = currentResponse.data;
    const currentEmployee =
      currentApiResponse.data ||
      currentApiResponse.employee ||
      currentApiResponse;

    const nextActive = currentEmployee?.active === false;
    const legacyResponse = await api.put(`/employees/${id}`, {
      active: nextActive,
    });
    const legacyApiResponse = legacyResponse.data;
    const updatedEmployee = legacyApiResponse.data || legacyApiResponse;

    return {
      message: nextActive
        ? "Empleado activado correctamente"
        : "Empleado pausado correctamente",
      employee: updatedEmployee,
    };
  },

  async getProfile(): Promise<{
    employee: Employee;
    stats: {
      totalSales: number;
      totalProducts: number;
      revenue: number;
    };
  }> {
    const response = await api.get("/employees/me/profile");
    // V2 API devuelve { success: true, data: { employee, stats } }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async getProducts(employeeId?: string): Promise<{
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
        employeePrice: number;
        clientPrice?: number;
        sku?: string;
        isActive: boolean;
      };
      quantity: number;
      lastRestock?: Date;
    }>;
    total: number;
  }> {
    const url = employeeId
      ? `/employees/${employeeId}/products`
      : "/employees/me/products";
    console.log("🔍 [employeeService.getProducts] URL:", url);
    const response = await api.get(url);
    console.log(
      "📦 [employeeService.getProducts] Raw response:",
      response.data
    );
    // V2 API devuelve { success: true, data: { products, total } }
    const apiResponse = response.data;
    const result = apiResponse.data || apiResponse;
    console.log("📦 [employeeService.getProducts] Parsed result:", result);
    return result;
  },

  async getPublicCatalog(employeeId: string): Promise<{
    products: Array<any>;
    employee: {
      name: string;
      phone?: string;
      email?: string;
    } | null;
    business: {
      name?: string;
      logoUrl?: string | null;
    } | null;
  }> {
    const response = await api.get(`/employees/${employeeId}/catalog`);
    const payload = response.data?.data || response.data;

    return {
      products: payload?.products || response.data?.products || [],
      employee: payload?.employee || response.data?.employee || null,
      business: payload?.business || response.data?.business || null,
    };
  },
};
