import type {
  Category,
  DistributorStock,
  Product,
  ProductImage,
  Sale,
  SaleStats,
  StockAlert,
  User,
} from "../types";
import api from "./axios.ts";

interface AuthResponse extends User {
  token: string;
}

type ProductPayload = {
  name: string;
  description: string;
  purchasePrice: number;
  suggestedPrice?: number;
  distributorPrice: number;
  clientPrice?: number;
  distributorCommission?: number;
  category: string;
  totalStock: number;
  warehouseStock?: number;
  lowStockAlert?: number;
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

// ==================== DISTRIBUTOR SERVICE ====================
export const distributorService = {
  async getAll(active?: boolean): Promise<User[]> {
    const params = active !== undefined ? { active } : {};
    const response = await api.get<User[]>("/distributors", { params });
    return response.data;
  },

  async getById(id: string): Promise<{
    distributor: User;
    stock: DistributorStock[];
    recentSales: Sale[];
    stats: { totalSales: number; totalProfit: number; totalRevenue: number };
  }> {
    const response = await api.get(`/distributors/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }): Promise<User> {
    const response = await api.post<User>("/distributors", data);
    return response.data;
  },

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      active?: boolean;
    }
  ): Promise<User> {
    const response = await api.put<User>(`/distributors/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/distributors/${id}`
    );
    return response.data;
  },

  async toggleActive(
    id: string
  ): Promise<{ message: string; active: boolean }> {
    const response = await api.patch<{ message: string; active: boolean }>(
      `/distributors/${id}/toggle-active`
    );
    return response.data;
  },
};

// ==================== STOCK SERVICE ====================
export const stockService = {
  async assignToDistributor(data: {
    distributorId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
    distributorStock: DistributorStock;
    warehouseStock: number;
  }> {
    const response = await api.post("/stock/assign", data);
    return response.data;
  },

  async withdrawFromDistributor(data: {
    distributorId: string;
    productId: string;
    quantity: number;
  }): Promise<{
    message: string;
    distributorStock: DistributorStock;
    warehouseStock: number;
  }> {
    const response = await api.post("/stock/withdraw", data);
    return response.data;
  },

  async getDistributorStock(distributorId: string): Promise<DistributorStock[]> {
    const response = await api.get<DistributorStock[]>(
      `/stock/distributor/${distributorId}`
    );
    return response.data;
  },

  async getAllStock(): Promise<DistributorStock[]> {
    const response = await api.get<DistributorStock[]>("/stock/all");
    return response.data;
  },

  async getAlerts(): Promise<StockAlert> {
    const response = await api.get<StockAlert>("/stock/alerts");
    return response.data;
  },
};

// ==================== SALE SERVICE ====================
export const saleService = {
  async register(data: {
    productId: string;
    quantity: number;
    salePrice: number;
    notes?: string;
  }): Promise<{
    message: string;
    sale: Sale;
    remainingStock: number;
  }> {
    const response = await api.post("/sales", data);
    return response.data;
  },

  async getDistributorSales(
    distributorId?: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      productId?: string;
    }
  ): Promise<{ sales: Sale[]; stats: SaleStats }> {
    const url = distributorId
      ? `/sales/distributor/${distributorId}`
      : "/sales/distributor";
    const response = await api.get(url, { params: filters });
    return response.data;
  },

  async getAllSales(filters?: {
    startDate?: string;
    endDate?: string;
    distributorId?: string;
    productId?: string;
  }): Promise<{ sales: Sale[]; stats: SaleStats }> {
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
};

