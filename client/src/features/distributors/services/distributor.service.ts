/**
 * Distributor Services
 * Extracted from monolithic api/services.ts
 * Handles distributor operations
 */

import api from "../../../api/axios";
import type { Distributor, User } from "../../../types";

export const distributorService = {
  async getAll(): Promise<Distributor[]> {
    const response = await api.get("/distributors");
    return response.data;
  },

  async getById(id: string): Promise<Distributor> {
    const response = await api.get(`/distributors/${id}`);
    return response.data;
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
    return response.data;
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
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/distributors/${id}`);
    return response.data;
  },

  async toggleActive(id: string): Promise<{
    message: string;
    distributor: Distributor;
  }> {
    const response = await api.put(`/distributors/${id}/toggle-active`);
    return response.data;
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
    return response.data;
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
    const response = await api.get(url);
    return response.data;
  },
};
