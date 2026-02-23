/**
 * Types for Admin Bulk Order System
 * Supports complex order management with location context, warranties, and financial logic
 */

// ==================== LOCATION TYPES ====================
export type LocationType = "warehouse" | "branch" | "distributor";

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  stock?: Map<string, number>; // productId -> quantity
}

// ==================== ORDER ITEM TYPES ====================
export interface OrderItem {
  id: string; // Unique ID for this line item
  productId: string;
  productName: string;
  promotionId?: string;
  quantity: number;
  unitPrice: number; // Editable by admin
  distributorPrice?: number; // Unit price paid to admin (promo override)
  isPromotion?: boolean;
  purchasePrice: number; // Cost for profit calculation
  subtotal: number;
  grossProfit: number;
  availableStock: number;
  category?: string;
  image?: { url: string; publicId?: string };
}

export interface WarrantyItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  type: "supplier_replacement" | "total_loss";
  reason?: string;
  availableStock: number;
  unitCost: number;
}

// ==================== ADDITIONAL COST TYPES ====================
export interface AdditionalCost {
  id: string;
  type: string;
  description: string;
  amount: number;
}

// ==================== PAYMENT & DELIVERY TYPES ====================
export type PaymentMethod = "cash" | "transfer" | "credit";
export type DeliveryMethod = "pickup" | "delivery";

// ==================== ORDER STATE ====================
export interface OrderState {
  // Location Context
  locationType: LocationType;
  locationId: string | null;
  locationName: string;
  isDistributorSale: boolean;
  distributorProfitPercentage: number;

  // Order Items
  items: OrderItem[];

  // Warranty/Loss Items
  warranties: WarrantyItem[];

  // Customer
  customerId: string | null;
  customerName: string | null;

  // Financial
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  shippingCost: number;
  discount: number; // Amount in currency
  discountPercent: number; // Percentage
  additionalCosts: AdditionalCost[];
  paymentProof: string | null;
  paymentProofMimeType: string | null;

  // Payment Details (for credit)
  creditDueDate: string | null;
  initialPayment: number;

  // Notes
  notes: string;

  // Calculated Values (derived)
  subtotal: number;
  totalCosts: number;
  grossProfit: number;
  netProfit: number;
  totalPayable: number;
}

// ==================== ORDER ACTIONS ====================
export type OrderAction =
  | {
      type: "SET_LOCATION";
      locationType: LocationType;
      locationId: string;
      locationName: string;
    }
  | {
      type: "ADD_ITEM";
      item: Omit<OrderItem, "id" | "subtotal" | "grossProfit">;
    }
  | {
      type: "UPDATE_ITEM";
      itemId: string;
      updates: Partial<
        Pick<
          OrderItem,
          | "quantity"
          | "unitPrice"
          | "distributorPrice"
          | "isPromotion"
          | "promotionId"
        >
      >;
    }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "ADD_WARRANTY"; warranty: Omit<WarrantyItem, "id"> }
  | { type: "REMOVE_WARRANTY"; warrantyId: string }
  | {
      type: "SET_CUSTOMER";
      customerId: string | null;
      customerName: string | null;
    }
  | { type: "SET_PAYMENT_METHOD"; method: PaymentMethod }
  | {
      type: "SET_PAYMENT_PROOF";
      paymentProof: string | null;
      paymentProofMimeType: string | null;
    }
  | { type: "SET_DELIVERY_METHOD"; method: DeliveryMethod }
  | { type: "SET_SHIPPING_COST"; cost: number }
  | { type: "SET_DISCOUNT"; amount: number }
  | { type: "SET_DISCOUNT_PERCENT"; percent: number }
  | { type: "ADD_ADDITIONAL_COST"; cost: Omit<AdditionalCost, "id"> }
  | { type: "REMOVE_ADDITIONAL_COST"; costId: string }
  | { type: "SET_CREDIT_DUE_DATE"; date: string | null }
  | { type: "SET_INITIAL_PAYMENT"; amount: number }
  | { type: "SET_NOTES"; notes: string }
  | {
      type: "SET_DISTRIBUTOR_PROFIT";
      isDistributorSale: boolean;
      profitPercentage: number;
    }
  | { type: "CLEAR_ORDER" }
  | { type: "RECALCULATE" };

// ==================== PRODUCT WITH STOCK INFO ====================
export interface ProductWithStock {
  _id: string;
  name: string;
  purchasePrice: number;
  averageCost?: number;
  clientPrice: number;
  distributorPrice: number;
  warehouseStock: number;
  totalStock: number;
  category?: { _id: string; name: string } | string;
  image?: { url: string; publicId?: string };
  branchStock?: number; // Filled when branch is selected
  distributorStock?: number; // Filled when selling as distributor
}

// ==================== PAYLOAD FOR BACKEND ====================
export interface AdminOrderPayload {
  // Items
  items: Array<{
    productId: string;
    promotionId?: string;
    quantity: number;
    salePrice: number;
    distributorPrice?: number;
    isPromotion?: boolean;
  }>;

  // Location
  locationType?: LocationType;
  branchId?: string; // If selling from branch

  // Customer & Payment
  customerId?: string;
  paymentMethodId: string;
  paymentType?: string;
  creditDueDate?: string;
  initialPayment?: number;
  paymentProof?: string;
  paymentProofMimeType?: string;

  // Delivery (shippingCost only - deliveryMethodId removed as it expects ObjectId, not string)
  shippingCost?: number;
  deliveryAddress?: string;

  // Financial
  discount?: number;
  additionalCosts?: Array<{
    type: string;
    description: string;
    amount: number;
  }>;

  // Warranties (processed separately as defective products)
  warranties?: Array<{
    productId: string;
    quantity: number;
    type: "supplier_replacement" | "total_loss";
    reason?: string;
  }>;

  // Notes
  notes?: string;

  // Group ID for atomic transaction
  saleGroupId?: string;
}
