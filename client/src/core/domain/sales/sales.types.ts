export interface EmployeeSalesFilters {
  startDate?: string;
  endDate?: string;
  productId?: string;
  limit?: number;
  statsOnly?: boolean;
}

export interface AllSalesFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  productId?: string;
  paymentStatus?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
  statsOnly?: boolean;
}

export interface EmployeeSalesResponse<TSale = unknown, TStats = unknown> {
  sales: TSale[];
  stats: TStats;
}

export interface AllSalesResponse<TSale = unknown, TStats = unknown> {
  success: boolean;
  sales: TSale[];
  stats: TStats;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export type SaleLocationType = "warehouse" | "branch" | "employee";

export interface SaleAdditionalCostInput {
  type: string;
  description: string;
  amount: number;
}

export interface SaleWarrantyInput {
  productId: string;
  quantity: number;
  type: "supplier_replacement" | "total_loss";
  reason?: string;
}

export interface StandardSaleItemInput {
  productId: string;
  quantity: number;
  salePrice: number;
}

export interface PromotionSaleItemInput {
  productId: string;
  promotionId: string;
  quantity: number;
  salePrice: number;
  isPromotion?: boolean;
}

export interface RegisterStandardSaleInput {
  items: StandardSaleItemInput[];
  employeeId?: string;
  branchId?: string;
  notes?: string;
  saleDate?: string;
  paymentType?: string;
  paymentMethodId?: string;
  customerId?: string;
  creditDueDate?: string;
  initialPayment?: number;
  paymentProof?: string;
  paymentProofMimeType?: string;
  deliveryMethodId?: string;
  shippingCost?: number;
  deliveryAddress?: string;
  additionalCosts?: SaleAdditionalCostInput[];
  discount?: number;
  saleGroupId?: string;
  locationType?: SaleLocationType;
  warranties?: SaleWarrantyInput[];
}

export interface RegisterPromotionSaleInput {
  items: PromotionSaleItemInput[];
  employeeId?: string;
  branchId?: string;
  notes?: string;
  saleDate?: string;
  paymentType?: string;
  paymentMethodId?: string;
  customerId?: string;
  creditDueDate?: string;
  initialPayment?: number;
  paymentProof?: string;
  paymentProofMimeType?: string;
  deliveryMethodId?: string;
  shippingCost?: number;
  deliveryAddress?: string;
  additionalCosts?: SaleAdditionalCostInput[];
  discount?: number;
  saleGroupId?: string;
  locationType?: SaleLocationType;
  warranties?: SaleWarrantyInput[];
}

export interface RegisterSaleResponse {
  success: boolean;
  message: string;
  data: {
    saleGroupId: string;
    totalAmount: number;
    totalItems: number;
    netProfit: number;
    adminProfit: number;
  };
}
