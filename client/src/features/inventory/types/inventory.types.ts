/**
 * Inventory & Product Types
 * Feature-Based Architecture
 */

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
  purchasePrice: number;
  suggestedPrice: number;
  employeePrice: number;
  salePrice?: number;
  clientPrice?: number;
  employeeCommission?: number;
  cost?: number;
  averageCost?: number;
  totalInventoryValue?: number;
  totalStock: number;
  warehouseStock: number;
  lowStockAlert: number;
  category: Category;
  image?: ProductImage | null;
  featured: boolean;
  ingredients?: string[];
  benefits?: string[];
  createdAt?: string;
  updatedAt?: string;
  isPromotion?: boolean;
  comboItems?: Array<{
    product: Product | string | { name: string };
    quantity: number;
  }>;
}

export interface EmployeeStock {
  _id: string;
  employee: unknown | string;
  product: Product | string;
  quantity: number;
  lowStockAlert: number;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchStock {
  _id: string;
  branch: unknown | string;
  product: Product | string;
  quantity: number;
  lowStockAlert: number;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockAlert {
  warehouseAlerts: Product[];
  employeeAlerts: EmployeeStock[];
}

export interface InventoryEntry {
  _id: string;
  product: Product | string;
  branch?: unknown | string;
  quantity: number;
  type: "entrada" | "salida" | "ajuste";
  reason?: string;
  notes?: string;
  reference?: string;
  unitCost?: number;
  totalCost?: number;
  previousStock?: number;
  newStock?: number;
  createdBy?: unknown | string;
  createdAt?: string;
  updatedAt?: string;
}
