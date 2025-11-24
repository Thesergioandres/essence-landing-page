export interface Category {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  url: string;
  publicId: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  // Precios
  purchasePrice: number;
  suggestedPrice: number;
  distributorPrice: number;
  clientPrice?: number;
  distributorCommission?: number;
  // Stock
  totalStock: number;
  warehouseStock: number;
  lowStockAlert: number;
  // Otros
  category: Category;
  image?: ProductImage | null;
  featured: boolean;
  ingredients?: string[];
  benefits?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "distribuidor";
  active?: boolean;
  phone?: string;
  address?: string;
  assignedProducts?: string[] | Product[];
  token?: string;
}

export interface DistributorStock {
  _id: string;
  distributor: User | string;
  product: Product | string;
  quantity: number;
  lowStockAlert: number;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sale {
  _id: string;
  distributor: User | string;
  product: Product | string;
  quantity: number;
  purchasePrice: number;
  distributorPrice: number;
  salePrice: number;
  distributorProfit: number;
  adminProfit: number;
  totalProfit: number;
  notes?: string;
  saleDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleStats {
  totalSales: number;
  totalQuantity: number;
  totalDistributorProfit: number;
  totalAdminProfit: number;
  totalRevenue: number;
}

export interface StockAlert {
  warehouseAlerts: Product[];
  distributorAlerts: DistributorStock[];
}
