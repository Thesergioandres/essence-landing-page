/**
 * Inventory Feature Types
 * Feature-Based Architecture - Self-contained types
 */

// ==================== PRODUCT TYPES ====================
export interface ProductImage {
  url: string;
  publicId?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: ProductImage;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  purchasePrice: number;
  suggestedPrice?: number;
  distributorPrice: number;
  clientPrice?: number;
  distributorCommission?: number;
  category?: Category | string;
  image?: ProductImage;
  featured?: boolean;
  ingredients?: string[];
  benefits?: string[];
  totalStock: number;
  warehouseStock?: number;
  lowStockAlert?: number;
  averageCost?: number;
  isPromotion?: boolean;
  active?: boolean;
  comboItems?: Array<{ product: string; quantity: number }>;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== STOCK TYPES ====================
export interface DistributorStock {
  _id: string;
  distributor: unknown | string;
  product: Product | string;
  quantity: number;
  reservedQuantity?: number;
  lowStockAlert?: number;
  lastRestockDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchStock {
  _id: string;
  branch: unknown | string;
  product: Product | string;
  quantity: number;
  reservedQuantity?: number;
  lowStockAlert?: number;
  lastRestockDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockAlert {
  warehouseAlerts: Product[];
  distributorAlerts: DistributorStock[];
}

// Re-export Branch from business types for convenience
export type { Branch } from "../../business/types/business.types";

// ==================== DEFECTIVE PRODUCT TYPES ====================
export interface DefectiveProduct {
  _id: string;
  distributor?: { _id: string; name: string; email?: string } | string | null;
  branch?: { _id: string; name: string } | string | null;
  product: { _id: string; name: string; image?: ProductImage } | string | null;
  quantity: number;
  reason: string;
  images?: Array<{ url: string; publicId: string }>;
  hasWarranty?: boolean;
  warrantyStatus?: "pending" | "approved" | "rejected" | "not_applicable";
  lossAmount?: number;
  stockRestored?: boolean;
  stockRestoredAt?: string;
  status: "pendiente" | "confirmado" | "rechazado";
  reportDate: string;
  confirmedAt?: string;
  confirmedBy?: unknown | string;
  adminNotes?: string;
  saleGroupId?: string;
  origin?: "direct" | "order";
  createdAt?: string;
  updatedAt?: string;
}

// ==================== ANALYTICS TYPES ====================
export interface ProductProfit {
  productId: string;
  productName: string;
  categoryName?: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  totalSales?: number;
}

// Feature-specific types
export interface ProductFormData {
  name: string;
  description?: string;
  purchasePrice: number;
  clientPrice: number;
  distributorPrice: number;
  suggestedPrice?: number;
  categoryId: string;
  image?: File | null;
}

export interface StockUpdatePayload {
  quantityChange: number;
  reason: string;
}

export interface ProductPayload {
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
  image?: { url: string; publicId: string } | null;
}

export interface InventoryEntry {
  _id: string;
  product: { _id: string; name: string } | string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  averageCostAfter?: number;
  branch?: { _id: string; name: string } | string;
  provider?: { _id: string; name: string } | string;
  notes?: string;
  purchaseGroupId?: string;
  destination: "branch" | "warehouse";
  requestId: string;
  createdAt: string;
}

export interface ProductHistoryEntry {
  _id: string;
  createdAt: string;
  provider?: { _id: string; name: string } | null;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  averageCostAfter?: number;
  notes?: string;
  purchaseGroupId?: string;
  requestId?: string;
}
