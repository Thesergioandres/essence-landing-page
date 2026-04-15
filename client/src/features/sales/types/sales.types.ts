/**
 * Sales Feature Types
 * Feature-Based Architecture - Self-contained types
 */

// ==================== SALE TYPES ====================
export interface SaleProduct {
  _id: string;
  name: string;
  description?: string;
  image?: { url: string; publicId?: string };
  category?: { _id: string; name: string; slug?: string } | string;
  employeePrice?: number;
  clientPrice?: number;
  purchasePrice?: number;
}

export interface SaleCustomer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SaleEmpleado {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface SaleBranch {
  _id: string;
  name: string;
  address?: string;
}

export interface Sale {
  _id: string;
  business: string;
  product?: SaleProduct | string | null;
  productName?: string;
  quantity: number;
  salePrice: number;
  purchasePrice?: number;
  averageCostAtSale?: number;
  employee?: SaleEmpleado | string | null;
  customer?: SaleCustomer | string | null;
  customerName?: string;
  branch?: SaleBranch | string | null;
  branchName?: string;
  paymentMethod?: unknown | string;
  paymentMethodCode?: string;
  deliveryMethod?: unknown | string | null;
  deliveryMethodCode?: string;
  paymentMethodName?: string;
  source?: "pos" | "catalog" | "special";
  adminProfit?: number;
  employeeProfit?: number;
  employeeProfitPercentage?: number;
  totalProfit?: number;
  totalGroupProfit?: number;
  netProfit?: number;
  shippingCost?: number;
  discount?: number;
  additionalCosts?: Array<{
    type: string;
    description: string;
    amount: number;
  }>;
  totalAdditionalCosts?: number;
  employeePrice?: number;
  isPromotion?: boolean;
  promotion?: { _id: string; name?: string } | string | null;
  saleGroupId?: string;
  saleId?: string;
  warrantyTicketId?: string;
  isComplementarySale?: boolean;
  parentSaleId?: string | null;
  parentSaleGroupId?: string | null;
  notes?: string;
  saleDate: string;
  sourceLocation?: "warehouse" | "branch" | "employee";
  paymentStatus: "pendiente" | "confirmado";
  paymentConfirmedAt?: string;
  paymentConfirmedBy?: unknown | string;
  paymentProof?: string;
  paymentProofMimeType?: string;
  isCredit?: boolean;
  creditId?:
    | {
        _id?: string;
        originalAmount?: number;
        paidAmount?: number;
        remainingAmount?: number;
        status?: "pendiente" | "parcial" | "pagado";
        dueDate?: string;
      }
    | string
    | null;
  credit?: {
    _id: string;
    sale: string;
    originalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: "pendiente" | "parcial" | "pagado";
    dueDate?: string;
  } | null;
  createdBy?:
    | { _id: string; name: string; email?: string; phone?: string }
    | string
    | null;
  createdAt?: string;
  updatedAt?: string;
  actualPayment?: number;
}

export interface SaleStats {
  totalSales: number;
  totalOrders?: number;
  totalQuantity: number;
  totalEmployeeProfit: number;
  totalAdminProfit: number;
  totalRevenue: number;
  confirmedRevenue?: number;
  confirmedSales?: number;
  pendingSales?: number;
  totalProfit?: number;
  creditSalesCount?: number;
  paidCreditSalesCount?: number;
  totalProfitFromCreditSales?: number;
  realizedProfitFromCredits?: number;
  pendingProfitFromCredits?: number;
}

// ==================== SALE ITEM TYPES ====================
export interface SaleItem {
  productId: string;
  name: string;
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
  customerId?: string;
  notes?: string;
  discount?: number;
  shippingCost?: number;
}

/**
 * Response from POST /api/v2/sales (RegisterSaleController)
 * Source: server/src/application/use-cases/RegisterSaleUseCase.js
 */
export interface SaleResponse {
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
