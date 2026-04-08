/**
 * Business & Branch Types
 * Feature-Based Architecture
 */

export interface BusinessFeatures {
  products?: boolean;
  inventory?: boolean;
  sales?: boolean;
  gamification?: boolean;
  incidents?: boolean;
  expenses?: boolean;
  assistant?: boolean;
  reports?: boolean;
  transfers?: boolean;
  promotions?: boolean;
  distributors?: boolean;
  rankings?: boolean;
  branches?: boolean;
  credits?: boolean;
  customers?: boolean;
  defectiveProducts?: boolean;
}

export interface BusinessConfig {
  features?: BusinessFeatures;
}

export interface PlanLimits {
  branches: number;
  distributors: number;
}

export interface BusinessPlanSnapshot {
  plan: "starter" | "pro" | "enterprise";
  source: "plan" | "custom" | "default";
  limits: PlanLimits;
  usage: PlanLimits;
  remaining: PlanLimits;
}

export interface Business {
  _id: string;
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactLocation?: string;
  logoUrl?: string;
  logoPublicId?: string;
  status?: "active" | "archived";
  plan?: "starter" | "pro" | "enterprise";
  customLimits?: Partial<PlanLimits>;
  config?: BusinessConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchConfig {
  ticketPrefix?: string;
  notes?: string;
}

export interface Branch {
  _id: string;
  business?: string;
  name: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  timezone?: string;
  config?: BranchConfig;
  isWarehouse?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Re-exported from inventory/product.types for convenience
export type { BranchStock } from "../../inventory/types/product.types";

// ==================== MEMBERSHIP TYPES ====================
export interface BusinessMembership {
  _id: string;
  user: unknown | string;
  business: Business | string;
  role: "admin" | "distribuidor" | "viewer";
  status: "active" | "pending" | "suspended";
  allowedBranches?: string[];
  invitedBy?: unknown | string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  _id: string;
  business: {
    _id: string;
    name: string;
    description?: string;
    plan?: "starter" | "pro" | "enterprise";
    config?: BusinessConfig;
    status?: Business["status"];
    logoUrl?: string;
  };
  user:
    | {
        _id: string;
        name: string;
        email: string;
      }
    | string
    | null;
  role: string;
  status: string;
  allowedBranches?: string[];
  permissions?: Record<string, Record<string, boolean>>;
}

// ==================== DISTRIBUTOR TYPES ====================
export interface Distributor {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: "distribuidor";
  status?: "pending" | "active" | "expired" | "suspended" | "paused";
  active?: boolean;
  assignedProducts?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ==================== BUSINESS ASSISTANT TYPES ====================
export type BusinessAssistantActionType =
  | "buy_more_inventory"
  | "pause_purchases"
  | "decrease_price"
  | "increase_price"
  | "run_promotion"
  | "review_margin"
  | "clearance"
  | "keep";

export type BusinessAssistantSuggestionCategory =
  | "inventario"
  | "precio"
  | "margen"
  | "demanda"
  | "operacion";

export type BusinessAssistantSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export interface BusinessAssistantRecommendationAction {
  action: BusinessAssistantActionType;
  title: string;
  confidence?: number;
  category?: BusinessAssistantSuggestionCategory;
  severity?: BusinessAssistantSeverity;
  suggestedQty?: number;
  suggestedChangePct?: number;
  impact?: {
    revenueCop?: number;
    profitCop?: number;
    inventoryValueCop?: number;
  };
  details?: {
    price?: {
      currentPriceCop?: number;
      suggestedPriceCop?: number;
      floorPriceCop?: number;
      targetMarginPct?: number;
      effectiveChangePct?: number;
    };
    targetDays?: number;
    avgDailyUnits?: number;
    daysCover?: number;
  };
}

export interface BusinessAssistantRecommendationItem {
  productId: string;
  productName: string;
  categoryId: string | null;
  categoryName?: string | null;
  abcClass?: "A" | "B" | "C";
  stock: {
    warehouseStock: number;
    branchesStock?: number;
    distributorsStock?: number;
    unassignedStock?: number;
    totalStock: number;
    lowStockAlert: number;
  };
  metrics: {
    recentDays: number;
    horizonDays: number | null;
    recentUnits: number;
    prevUnits: number;
    unitsGrowthPct: number;
    recentRevenue: number;
    recentProfit: number;
    recentMarginPct: number;
    avgUnitProfitCop?: number;
    avgDailyUnits: number;
    daysCover: number | null;
    recentAvgPrice: number;
    categoryAvgPrice: number;
    priceVsCategoryPct: number;
    inventoryValueCop?: number;
    lastSaleDate?: string | null;
    daysSinceLastSale?: number | null;
    recentSalesCount?: number;
  };
  recommendation: {
    primary: BusinessAssistantRecommendationAction | null;
    actions: BusinessAssistantRecommendationAction[];
    justification: string[];
    score?: {
      impactScore?: number;
    };
    notes?: string;
  };
}

export interface BusinessAssistantPromotion {
  type: "combo" | "volume" | "bundle" | "discount" | "percentage";
  title: string;
  description: string;
  products: string[];
  strategy?: "reactivation" | "clearance" | "cross_sell" | "volume";
  priority?: "high" | "medium" | "low";
  discountPct?: number;
  reason?: string;
  insights?: string[];
}

export interface BusinessAssistantRecommendationsResponse {
  generatedAt: string;
  window: {
    horizonDays: number | null;
    recentDays: number;
    startDate: string | null;
    endDate: string | null;
  };
  recommendations: BusinessAssistantRecommendationItem[];
  promotions?: BusinessAssistantPromotion[];
}

export interface BusinessAssistantConfig {
  _id: string;
  horizonDaysDefault: number;
  recentDaysDefault: number;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  daysCoverLowThreshold: number;
  buyTargetDays: number;
  lowRotationUnitsThreshold: number;
  highStockMultiplier: number;
  highStockMinUnits: number;
  trendDropThresholdPct: number;
  trendGrowthThresholdPct: number;
  minUnitsForGrowthStrategy: number;
  marginLowThresholdPct: number;
  targetMarginPct: number;
  minMarginAfterDiscountPct: number;
  priceHighVsCategoryThresholdPct: number;
  priceLowVsCategoryThresholdPct: number;
  decreasePricePct: number;
  promotionDiscountPct: number;
  increasePricePct: number;
  newProductGraceDays?: number;
  minRecentUnitsForPriceChange?: number;
  minRecentUnitsForDemandSignal?: number;
  priceElasticity?: number;
  clearanceDiscountPct?: number;
  abcClassAThreshold?: number;
  abcClassBThreshold?: number;
  categoryOverrides?: Array<{
    categoryId: string;
    targetMarginPct?: number;
    daysCoverLowThreshold?: number;
    buyTargetDays?: number;
    priceHighVsCategoryThresholdPct?: number;
    priceLowVsCategoryThresholdPct?: number;
  }>;
  productOverrides?: Array<{
    productId: string;
    targetMarginPct?: number;
    daysCoverLowThreshold?: number;
    buyTargetDays?: number;
    priceHighVsCategoryThresholdPct?: number;
    priceLowVsCategoryThresholdPct?: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessAssistantJobStatus {
  jobId: string;
  status:
    | "completed"
    | "failed"
    | "waiting"
    | "active"
    | "delayed"
    | "paused"
    | "waiting-children";
  progress: unknown;
  result: BusinessAssistantRecommendationsResponse | null;
  failedReason: string | null;
}
