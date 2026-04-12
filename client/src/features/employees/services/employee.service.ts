/**
 * Employee Services
 * Extracted from monolithic api/services.ts
 * Handles employee operations
 */

import api from "../../../api/axios";
import type { User } from "../../auth/types/auth.types";
import type { Employee } from "../../business/types/business.types";

const EMPLOYEE_ENDPOINT_CANDIDATES = ["/employees", "/employees"];
let cachedEmployeeEndpoint: string | null = null;

const isNotFoundError = (error: unknown): boolean =>
  Boolean(
    (error as { response?: { status?: number } })?.response?.status === 404
  );

const requestWithEmployeeEndpointFallback = async <T>(
  requestFactory: (endpoint: string) => Promise<T>
): Promise<T> => {
  const endpoints = cachedEmployeeEndpoint
    ? [
        cachedEmployeeEndpoint,
        ...EMPLOYEE_ENDPOINT_CANDIDATES.filter(
          endpoint => endpoint !== cachedEmployeeEndpoint
        ),
      ]
    : [...EMPLOYEE_ENDPOINT_CANDIDATES];

  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      const result = await requestFactory(endpoint);
      cachedEmployeeEndpoint = endpoint;
      return result;
    } catch (error) {
      lastError = error;
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

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
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.get(endpoint, { params })
    );
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
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.get(`${endpoint}/${id}`)
    );
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
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.post(endpoint, data)
    );
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
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.put(`${endpoint}/${id}`, data)
    );
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
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.delete(`${endpoint}/${id}`)
    );
    // V2 API devuelve { success: true, data: {...} }
    const apiResponse = response.data;
    return apiResponse.data || apiResponse;
  },

  async toggleActive(id: string): Promise<{
    message: string;
    employee: User;
  }> {
    return requestWithEmployeeEndpointFallback(async endpoint => {
      try {
        const response = await api.put(`${endpoint}/${id}/toggle-active`, null);
        const apiResponse = response.data;
        return apiResponse.data || apiResponse;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }

        const currentResponse = await api.get(`${endpoint}/${id}`);
        const currentApiResponse = currentResponse.data;
        const currentEmployee =
          currentApiResponse.data ||
          currentApiResponse.employee ||
          currentApiResponse;

        const nextActive = currentEmployee?.active === false;
        const legacyResponse = await api.put(`${endpoint}/${id}`, {
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
      }
    });
  },

  async getProfile(): Promise<{
    employee: Employee;
    stats: {
      totalSales: number;
      totalProducts: number;
      revenue: number;
    };
  }> {
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.get(`${endpoint}/me/profile`)
    );
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
    const response = await requestWithEmployeeEndpointFallback(endpoint => {
      const url = employeeId
        ? `${endpoint}/${employeeId}/products`
        : `${endpoint}/me/products`;

      return api.get(url);
    });

    // V2 API devuelve { success: true, data: { products, total } }
    const apiResponse = response.data;
    const result = apiResponse.data || apiResponse;

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
    const response = await requestWithEmployeeEndpointFallback(endpoint =>
      api.get(`${endpoint}/${employeeId}/catalog`)
    );
    const payload = response.data?.data || response.data;

    return {
      products: payload?.products || response.data?.products || [],
      employee: payload?.employee || response.data?.employee || null,
      business: payload?.business || response.data?.business || null,
    };
  },
};
