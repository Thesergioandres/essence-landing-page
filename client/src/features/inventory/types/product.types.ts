export interface Product {
  _id: string;
  name: string;
  description?: string;
  purchasePrice: number;
  clientPrice: number;
  distributorPrice: number;
  suggestedPrice?: number;
  totalStock: number;
  warehouseStock: number;
  image?: {
    url: string;
    public_id: string;
  };
  category?: string | { _id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
}

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
