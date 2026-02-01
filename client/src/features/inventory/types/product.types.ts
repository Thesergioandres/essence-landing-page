/**
 * Inventory Feature Types
 * Re-exports from main types for feature isolation
 */

// Re-export from main types (these remain canonical in types/index.ts)
export type {
  BranchStock,
  Category,
  DefectiveProduct,
  DistributorStock,
  Product,
  ProductImage,
  ProductProfit,
  StockAlert,
} from "../../../types";

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
  branch?: { _id: string; name: string } | string;
  provider?: { _id: string; name: string } | string;
  notes?: string;
  destination: "branch" | "warehouse";
  requestId: string;
  createdAt: string;
}
