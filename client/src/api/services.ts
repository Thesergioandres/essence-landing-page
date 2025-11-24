import type { Category, Product, ProductImage, User } from "../types";
import api from "./axios.ts";

interface AuthResponse extends User {
  token: string;
}

type ProductPayload = {
  name: string;
  description: string;
  price: number;
  category: string; // Ahora es el ID de la categoría
  stock: number;
  featured: boolean;
  ingredients?: string[];
  benefits?: string[];
  image?: ProductImage | null;
};

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
    }

    return response.data;
  },

  logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser(): (AuthResponse & { token: string }) | null {
    const user = localStorage.getItem("user");
    return user ? (JSON.parse(user) as AuthResponse & { token: string }) : null;
  },

  async getProfile(): Promise<User> {
    const response = await api.get<User>("/auth/profile");
    return response.data;
  },
};

export const productService = {
  async getAll(
    filters: Record<string, string | boolean> = {}
  ): Promise<Product[]> {
    const response = await api.get<Product[]>("/products", { params: filters });
    return response.data;
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async getAllCategories(): Promise<Category[]> {
    return categoryService.getAll();
  },

  async create(productData: ProductPayload): Promise<Product> {
    const response = await api.post<Product>("/products", productData);
    return response.data;
  },

  async update(
    id: string,
    productData: Partial<ProductPayload>
  ): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, productData);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/products/${id}`);
    return response.data;
  },
};

export const uploadService = {
  async uploadImage(file: File): Promise<ProductImage> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await api.post<ProductImage>("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  async deleteImage(publicId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/upload/${publicId}`
    );
    return response.data;
  },
};

export const categoryService = {
  async getAll(): Promise<Category[]> {
    const response = await api.get<Category[]>("/categories");
    return response.data;
  },

  async getById(id: string): Promise<Category> {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
  }): Promise<Category> {
    const response = await api.post<Category>("/categories", data);
    return response.data;
  },

  async update(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Category> {
    const response = await api.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/categories/${id}`);
    return response.data;
  },
};
