export interface SaleItem {
  productId: string;
  name: string; // snapshots
  quantity: number;
  salePrice: number;
  subtotal: number;
  availableStock?: number;
}

export interface BulkSalePayload {
  items: Array<{
    productId: string;
    quantity: number;
    salePrice: number;
  }>;
  paymentMethodId: string;
  deliveryMethodId?: string;
  customerId?: string; // For credit
  notes?: string;
  discount?: number;
  shippingCost?: number;
}

export interface SaleResponse {
  success: boolean;
  message: string;
  data: {
    saleGroupId: string;
    totalAmount: number;
    totalItems: number;
    // Server calculated fields
    netProfit: number;
    adminProfit: number;
  };
}
