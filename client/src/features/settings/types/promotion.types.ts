/**
 * Promotion Types
 * Feature-Based Architecture
 */

export type PromotionType =
  | "bogo"
  | "combo"
  | "volume"
  | "discount"
  | "bundle"
  | "fixed"
  | "percentage";
export type PromotionStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived"
  | "scheduled"
  | "expired"
  | "disabled";

export interface PromotionComboItem {
  product:
    | {
        _id: string;
        name: string;
        image?: { url: string; publicId?: string };
        clientPrice?: number;
        suggestedPrice?: number;
        purchasePrice?: number;
        employeePrice?: number;
      }
    | string;
  quantity: number;
  unitPrice?: number;
}

export interface PromotionRewardItem {
  product:
    | {
        _id: string;
        name: string;
        image?: { url: string; publicId?: string };
        clientPrice?: number;
        suggestedPrice?: number;
        purchasePrice?: number;
        employeePrice?: number;
      }
    | string;
  quantity: number;
  discountType: "percentage" | "amount" | "free";
  discountValue: number;
}

export interface Promotion {
  _id: string;
  business: string;
  name: string;
  description?: string;
  image?: {
    url: string;
    publicId?: string;
  };
  type: PromotionType;
  status: PromotionStatus;
  exclusive?: boolean;
  startDate?: string;
  endDate?: string;
  branches?: Array<string | { _id: string; name?: string }>;
  allowAllLocations?: boolean;
  allowedLocations?: Array<string | { _id: string; name?: string }>;
  allowAllEmployees?: boolean;
  allowedEmployees?: Array<string | { _id: string; name?: string }>;
  segments?: string[];
  customers?: unknown[] | string[];
  buyItems?: PromotionComboItem[];
  rewardItems?: PromotionRewardItem[];
  comboItems?: PromotionComboItem[];
  promotionPrice?: number;
  employeePrice?: number;
  originalPrice?: number;
  discount?: {
    type: "percentage" | "amount";
    value: number;
  };
  thresholds?: {
    minQty?: number;
    minSubtotal?: number;
  };
  volumeRule?: {
    minQty: number;
    discountType: "percentage" | "amount";
    discountValue: number;
  };
  totalStock?: number | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  displayOrder?: number;
  showInCatalog?: boolean;
  financialImpact?: {
    expectedMargin?: number;
    employeeCommission?: number;
    notes?: string;
  };
  usageCount?: number;
  lastUsedAt?: string;
  totalRevenue?: number;
  totalUnitsSold?: number;
  createdBy?: unknown | string;
  updatedBy?: unknown | string;
  createdAt?: string;
  updatedAt?: string;
  savings?: number;
  savingsPercentage?: number;
  value?: number;
  minPurchase?: number;
  maxDiscount?: number;
  applicableProducts?: string[];
  perCustomerLimit?: number;
  isActive?: boolean;
}

export interface PromotionStats {
  total: number;
  active: number;
  paused: number;
  archived: number;
  scheduled?: number;
  totalRevenue: number;
  totalUnitsSold: number;
}

export interface PromotionMetrics {
  overview: {
    totalPromotions: number;
    activePromotions: number;
    totalRevenue: number;
    totalUnitsSold: number;
    totalSavings: number;
    averageOrderValue: number;
  };
  topSelling: Array<{
    _id: string;
    name: string;
    type: PromotionType;
    unitsSold: number;
    revenue: number;
  }>;
  topRevenue: Array<{
    _id: string;
    name: string;
    type: PromotionType;
    revenue: number;
    unitsSold: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    count: number;
    quantity: number;
  }>;
  totalRevenue?: number;
  totalDiscount?: number;
  usageCount?: number;
  topPromotions?: Array<{
    _id: string;
    name: string;
    usageCount: number;
  }>;
}
