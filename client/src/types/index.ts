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
  // Precios
  purchasePrice: number;
  suggestedPrice: number;
  distributorPrice: number;
  clientPrice?: number;
  distributorCommission?: number;
  cost?: number;
  averageCost?: number; // Costo promedio ponderado
  totalInventoryValue?: number; // Valor total del inventario
  // Stock
  totalStock: number;
  warehouseStock: number;
  lowStockAlert: number;
  // Otros
  category: Category;
  image?: ProductImage | null;
  featured: boolean;
  ingredients?: string[];
  benefits?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "distribuidor" | "super_admin" | "god";
  status?: "pending" | "active" | "expired" | "suspended" | "paused";
  subscriptionExpiresAt?: string | null;
  active?: boolean;
  phone?: string;
  address?: string;
  assignedProducts?: string[] | Product[];
  token?: string;
}

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

export interface Membership {
  _id: string;
  business: Business;
  user: User | string;
  role: "admin" | "distribuidor" | "super_admin";
  status: "active" | "invited" | "inactive";
  allowedBranches?: (Branch | string)[];
  permissions?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  _id: string;
  business: string;
  name: string;
  email?: string;
  phone?: string;
  segment?: string;
  segments?: string[];
  points: number;
  totalSpend: number;
  totalDebt: number;
  ordersCount: number;
  lastPurchaseAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DistributorStock {
  _id: string;
  distributor: User | string;
  product: Product | string;
  quantity: number;
  lowStockAlert: number;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchStock {
  _id: string;
  branch: Branch | string;
  product: Product | string;
  quantity: number;
  lowStockAlert: number;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== PROMOTION TYPES ====================
export type PromotionType = "bogo" | "combo" | "volume" | "discount" | "bundle";
export type PromotionStatus = "draft" | "active" | "paused" | "archived";

export interface PromotionComboItem {
  product: Product | string;
  quantity: number;
  unitPrice?: number;
}

export interface PromotionRewardItem {
  product: Product | string;
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
  branches?: Branch[] | string[];
  segments?: string[];
  customers?: Customer[] | string[];
  // BOGO fields
  buyItems?: PromotionComboItem[];
  rewardItems?: PromotionRewardItem[];
  // Combo/Bundle fields
  comboItems?: PromotionComboItem[];
  promotionPrice?: number;
  originalPrice?: number;
  // Discount fields
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
  // Stock and limits
  totalStock?: number | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  // Display
  displayOrder?: number;
  showInCatalog?: boolean;
  // Financial
  financialImpact?: {
    expectedMargin?: number;
    distributorCommission?: number;
    notes?: string;
  };
  // Metrics
  usageCount?: number;
  lastUsedAt?: string;
  totalRevenue?: number;
  totalUnitsSold?: number;
  // Audit
  createdBy?: User | string;
  updatedBy?: User | string;
  createdAt?: string;
  updatedAt?: string;
  // Computed fields (from API)
  savings?: number;
  savingsPercentage?: number;
}

export interface PromotionStats {
  total: number;
  active: number;
  paused: number;
  archived: number;
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
}

export interface Sale {
  _id: string;
  saleId: string;
  saleGroupId?: string; // ⭐ Campo para agrupar ventas del mismo carrito
  distributor: User | string;
  createdBy?: User | string; // Usuario que registró la venta (para ventas admin)
  product: Product | string;
  branch?: Branch | string;
  customer?: Customer | string;
  customerName?: string;
  quantity: number;
  purchasePrice: number;
  distributorPrice: number;
  salePrice: number;
  distributorProfit: number;
  adminProfit: number;
  totalProfit: number;
  // Ganancia neta (después de costos adicionales, envío y descuentos)
  netProfit?: number;
  // Costos adicionales por venta
  additionalCosts?: Array<{
    type: string;
    description?: string;
    amount: number;
  }>;
  totalAdditionalCosts?: number;
  shippingCost?: number;
  discount?: number;
  actualPayment?: number;
  distributorProfitPercentage?: number;
  notes?: string;
  saleDate: string;
  paymentStatus: "pendiente" | "confirmado";
  paymentConfirmedAt?: string;
  paymentConfirmedBy?: User | string;
  paymentProof?: string;
  paymentProofMimeType?: string;
  // Backend fields for credit
  isCredit?: boolean;
  creditId?:
    | {
        _id: string;
        originalAmount: number;
        paidAmount: number;
        remainingAmount: number;
        status: string;
        dueDate?: string;
      }
    | string
    | null;
  // Alternative nested credit field (some endpoints use this)
  credit?: {
    _id: string;
    sale: string;
    originalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: "pendiente" | "parcial" | "pagado";
    dueDate?: string;
  } | null;
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
  stock: {
    warehouseStock: number;
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

export interface BusinessAssistantRecommendationsResponse {
  generatedAt: string;
  window: {
    horizonDays: number | null;
    recentDays: number;
    startDate: string | null;
    endDate: string | null;
  };
  recommendations: BusinessAssistantRecommendationItem[];
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

export interface Expense {
  _id: string;
  type: string;
  category?: string;
  amount: number;
  description?: string;
  expenseDate: string;
  createdBy?: User | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleStats {
  totalSales: number;
  totalQuantity: number;
  totalDistributorProfit: number;
  totalAdminProfit: number;
  totalRevenue: number;
  confirmedRevenue?: number; // Ingresos solo de ventas sin crédito pendiente
  confirmedSales?: number;
  pendingSales?: number;
  totalProfit?: number;
  // Métricas de créditos
  creditSalesCount?: number;
  paidCreditSalesCount?: number;
  totalProfitFromCreditSales?: number;
  realizedProfitFromCredits?: number;
  pendingProfitFromCredits?: number;
}

export interface StockAlert {
  warehouseAlerts: Product[];
  distributorAlerts: DistributorStock[];
}

export interface DefectiveProduct {
  _id: string;
  distributor?: User | string | null; // Opcional: null cuando es reporte de admin desde bodega
  branch?: Branch | string | null;
  product: Product | string;
  quantity: number;
  reason: string;
  images?: ProductImage[];
  hasWarranty?: boolean;
  warrantyStatus?: "pending" | "approved" | "rejected" | "not_applicable";
  lossAmount?: number;
  stockRestored?: boolean;
  stockRestoredAt?: string;
  status: "pendiente" | "confirmado" | "rechazado";
  reportDate: string;
  confirmedAt?: string;
  confirmedBy?: User | string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== ANALYTICS TYPES ====================
export interface MonthlyProfitData {
  currentMonth: {
    adminProfit: number;
    distributorProfit: number;
    totalProfit: number;
    revenue: number;
    cost: number;
    salesCount: number;
    unitsCount: number;
  };
  lastMonth: {
    adminProfit: number;
    distributorProfit: number;
    totalProfit: number;
    revenue: number;
    cost: number;
    salesCount: number;
    unitsCount: number;
  };
  growthPercentage: number;
  averageTicket: number;
  _debug?: {
    nowUTC: string;
    nowColombia: string;
    startOfMonth: string;
    endOfMonth: string;
    startOfLastMonth: string;
    endOfLastMonth: string;
    currentMonthSalesCount: number;
    lastMonthSalesCount: number;
  };
}

export interface ProductProfit {
  productId: string;
  productName: string;
  productImage?: ProductImage;
  totalQuantity: number;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalAdminProfit: number;
  totalDistributorProfit: number;
  totalProfit: number;
  profitMargin: number;
}

export interface DistributorProfit {
  distributorId: string;
  distributorName: string;
  distributorEmail: string;
  totalQuantity: number;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalAdminProfit: number;
  totalDistributorProfit: number;
  totalProfit: number;
  averageSale: number;
}

export interface Averages {
  period: "day" | "week" | "month";
  days: number;
  averageRevenuePerDay: number;
  averageProfitPerDay: number;
  averageSalesPerDay: number;
  averageUnitsPerDay: number;
  totalRevenue: number;
  totalProfit: number;
  totalSales: number;
  totalUnits: number;
}

export interface TimelineData {
  date: string;
  sales: number;
  revenue: number;
  profit: number;
  units: number;
  cost: number;
}

export interface FinancialSummary {
  totalCost: number;
  totalRevenue: number;
  totalAdminProfit: number;
  totalDistributorProfit: number;
  totalProfit: number;
  totalSales: number;
  totalUnits: number;
  profitMargin: number;
  averageTicket: number;
  defectiveUnits: number;
  defectiveRate: number;
}

export interface AnalyticsDashboard {
  monthlyTotals: {
    totalRevenue: number;
    totalProfit: number;
    totalSales: number;
  };
  topProducts: Array<{
    _id: string;
    name: string;
    image?: ProductImage;
    totalQuantity: number;
    totalProfit: number;
  }>;
  topDistributors: Array<{
    _id: string;
    name: string;
    totalSales: number;
    totalProfit: number;
  }>;
  creditMetrics?: {
    totalCredits: number;
    totalDebt: number;
    totalPaid: number;
    overdueCount: number;
    overdueAmount: number;
    recoveryRate: number | string;
    topDebtors: Array<{
      customerId: string;
      customerName: string;
      totalDebt: number;
      creditsCount: number;
    }>;
  };
}

// ==================== PROFIT HISTORY TYPES ====================
export interface ProfitHistoryEntry {
  _id: string;
  user: User | string;
  type: "venta_normal" | "venta_especial" | "ajuste" | "bonus";
  amount: number;
  sale?: Sale | string;
  specialSale?:
    | {
        _id: string;
        eventName?: string;
      }
    | string;
  product?: Product | string;
  description: string;
  date: string;
  balanceAfter: number;
  metadata?: {
    quantity?: number;
    salePrice?: number;
    commission?: number;
    eventName?: string;
    saleId?: string;
    percentage?: number;
    distributionNotes?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfitHistoryResponse {
  history: ProfitHistoryEntry[];
  summary: {
    totalAmount: number;
    count: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface ProfitHistoryAdminEntry {
  id: string;
  saleId: string;
  date: string;
  source: "normal" | "special";
  distributorId: string | null;
  distributorName: string;
  distributorEmail: string | null;
  type: "venta_distribuidor" | "venta_admin";
  adminProfit: number;
  distributorProfit: number;
  totalProfit: number;
  quantity: number;
  productName: string;
  eventName?: string;
  paymentStatus?: string;
}

export interface ProfitHistoryAdminDistributor {
  id: string;
  name: string;
  email?: string | null;
  totalProfit: number;
  adminProfit: number;
  distributorProfit: number;
  sales: number;
}

export interface ProfitHistoryAdminOverview {
  summary: {
    totalProfit: number;
    adminProfit: number;
    distributorProfit: number;
    count: number;
    averageTicket: number;
  };
  distributors: ProfitHistoryAdminDistributor[];
  entries: ProfitHistoryAdminEntry[];
}

export interface UserBalance {
  totalBalance: number;
  breakdown: {
    venta_normal: number;
    venta_especial: number;
    ajuste: number;
    bonus: number;
  };
  transactionCount: number;
  lastUpdate: string | null;
}

export interface ProfitSummary {
  timeline: Array<{
    _id: string;
    totalAmount: number;
    count: number;
    types: string[];
  }>;
  byType: Array<{
    _id: string;
    totalAmount: number;
    count: number;
  }>;
  topUsers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    totalAmount: number;
    count: number;
  }>;
  groupBy: "day" | "week" | "month";
}

export interface ComparativeAnalysis {
  currentMonth: {
    total: number;
    count: number;
    avgAmount: number;
  };
  previousMonth: {
    total: number;
    count: number;
    avgAmount: number;
  };
  difference: number;
  percentageChange: number;
}

// ==================== AUDIT LOG TYPES ====================
export interface AuditLog {
  _id: string;
  user: User | string;
  userEmail: string;
  userName: string;
  userRole: "admin" | "distribuidor" | "user";
  action: string;
  module: string;
  description: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity: "info" | "warning" | "error" | "critical";
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  currentPage: number;
  totalPages: number;
  totalLogs: number;
}

export interface DailySummary {
  date: string;
  totalActions: number;
  actionSummary: Record<string, number>;
  moduleSummary: Record<string, number>;
  topUsers: Array<{
    name: string;
    email: string;
    count: number;
  }>;
  sales: {
    count: number;
    revenue: number;
    profit: number;
    units: number;
  };
  inventory: {
    warehouse: {
      totalProducts: number;
      totalWarehouseStock: number;
      totalStock: number;
    };
    distributed: number;
  };
}

export interface UserActivity {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  totalActions: number;
  actionCounts: Record<string, number>;
  moduleCounts: Record<string, number>;
  recentLogs: AuditLog[];
}

export interface EntityHistory {
  entityType: string;
  entityId: string;
  totalChanges: number;
  history: AuditLog[];
}

export interface AuditStats {
  period: string;
  totalActions: number;
  actionStats: Record<string, number>;
  moduleStats: Record<string, number>;
  severityStats: Record<string, number>;
  dailyActivity: Record<string, number>;
  topUsers: Array<{
    name: string;
    email: string;
    role: string;
    count: number;
  }>;
}

// ==================== GAMIFICATION TYPES ====================
export interface SalesTarget {
  level: string;
  minAmount: number;
  bonus: number;
  badge: string;
}

export interface ProductBonus {
  product: string;
  bonusPerUnit: number;
  minQuantity?: number;
}

export interface GamificationConfig {
  _id: string;
  evaluationPeriod: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  customPeriodDays?: number;
  topPerformerBonus: number;
  secondPlaceBonus: number;
  thirdPlaceBonus: number;
  top1CommissionBonus?: number;
  top2CommissionBonus?: number;
  top3CommissionBonus?: number;
  minAdminProfitForRanking?: number;
  currentPeriodStart?: string;
  salesTargets: SalesTarget[];
  productBonuses: ProductBonus[];
  pointsPerSale: number;
  pointsPerPeso: number;
  active: boolean;
  nextEvaluationDate?: string;
  lastEvaluationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopPerformer {
  distributor: string;
  position: number;
  totalRevenue: number;
  salesCount: number;
  bonus: number;
}

export interface PeriodWinner {
  _id: string;
  periodType: string;
  startDate: string;
  endDate: string;
  winner: User | string;
  winnerName: string;
  winnerEmail: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  salesCount: number;
  bonusAmount: number;
  bonusPaid: boolean;
  bonusPaidAt?: string;
  topPerformers: TopPerformer[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  type: string;
  name: string;
  description: string;
  badge: string;
  earnedAt: string;
  value?: number;
}

export interface DistributorStats {
  _id: string;
  distributor: User | string;
  totalPoints: number;
  currentMonthPoints: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  totalBonusEarned: number;
  pendingBonuses: number;
  paidBonuses: number;
  lastBonusDate?: string;
  achievements: Achievement[];
  currentLevel: string;
  currentStreak: number;
  longestStreak: number;
  periodWins: number;
  topThreeFinishes: number;
  createdAt: string;
  updatedAt: string;
}

export interface RankingEntry {
  distributorId: string;
  distributorName: string;
  distributorEmail: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  totalUnits: number;
  position: number;
  totalPoints: number;
  currentLevel: string;
  periodWins: number;
  profitPercentage?: number;
}

export interface RankingResponse {
  period: {
    startDate: string;
    endDate: string;
    type: string;
  };
  rankings: RankingEntry[];
  config: {
    topPerformerBonus: number;
    secondPlaceBonus: number;
    thirdPlaceBonus: number;
    top1CommissionBonus?: number;
    top2CommissionBonus?: number;
    top3CommissionBonus?: number;
    evaluationPeriod?: string;
    customPeriodDays?: number;
    currentPeriodStart?: string;
  };
}

export interface WinnersResponse {
  winners: PeriodWinner[];
  currentPage: number;
  totalPages: number;
  total: number;
}

export interface DistributorStatsResponse {
  stats: DistributorStats;
  currentRankingPosition: number;
  totalDistributors: number;
}

export interface IssueReport {
  _id: string;
  message: string;
  stackTrace?: string;
  logs: string[];
  clientContext?: {
    url?: string;
    userAgent?: string;
    appVersion?: string;
    businessId?: string | null;
  };
  screenshotUrl?: string;
  screenshotPublicId?: string;
  status: "open" | "reviewing" | "closed";
  user?: Pick<User, "_id" | "name" | "email" | "role">;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== CREDIT/FIADO TYPES ====================

export interface CreditItem {
  product?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CreditStatusHistory {
  status: string;
  changedAt: string;
  changedBy?: string;
  note?: string;
}

export interface Credit {
  _id: string;
  customer: Customer | string;
  business: string;
  sale?: Sale | string;
  branch?: Branch | string;
  createdBy: User | string;
  originalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
  dueDate?: string;
  description?: string;
  items: CreditItem[];
  lastPaymentAt?: string;
  paidAt?: string;
  statusHistory: CreditStatusHistory[];
  createdAt?: string;
  updatedAt?: string;
  // Información de ganancias (viene cuando se carga el detalle)
  profitInfo?: CreditProfitInfo;
}

// Información de ganancias del crédito
export interface CreditProfitInfo {
  // Información básica del crédito
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isPaidCompletely: boolean;
  // Información de la venta asociada
  saleId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalSaleAmount: number;
  // Costos
  unitCost: number;
  totalCost: number;
  // Ganancias
  adminProfit: number;
  distributorProfit: number;
  totalProfit: number;
  distributorProfitPercentage: number;
  profitMarginPercentage: number;
  // Información del distribuidor (si aplica)
  isDistributorSale: boolean;
  distributorName?: string;
  distributorEmail?: string;
  amountDistributorOwesToAdmin?: number;
  // Estado de realización de la ganancia
  profitRealized: boolean;
  realizedProfit: number;
  pendingProfit: number;
}

export interface CreditPayment {
  _id: string;
  credit: string;
  business: string;
  amount: number;
  paymentMethod: "cash" | "transfer" | "card" | "other";
  registeredBy: User | string;
  branch?: Branch | string;
  notes?: string;
  receiptUrl?: string;
  paymentProof?: string;
  paymentProofMimeType?: string;
  balanceBefore: number;
  balanceAfter: number;
  paymentDate: string;
  createdAt?: string;
}

export interface CreditMetrics {
  total: {
    totalCredits: number;
    totalOriginalAmount: number;
    totalRemainingAmount: number;
    totalPaidAmount: number;
  };
  overdue: {
    count: number;
    amount: number;
  };
  byStatus: Record<string, { count: number; amount: number }>;
  topDebtors: Array<{
    customerId: string;
    customerName: string;
    customerPhone?: string;
    totalDebt: number;
    creditsCount: number;
  }>;
  recentPayments: CreditPayment[];
  recoveryRate: number | string;
  // Nuevas métricas de ganancias
  paidCreditsProfit?: {
    count: number;
    totalAmount: number;
    adminProfit: number;
    distributorProfit: number;
    totalProfit: number;
  };
  pendingCreditsProfit?: {
    count: number;
    totalAmount: number;
    remainingAmount: number; // Lo que falta por pagar
    adminProfit: number;
    distributorProfit: number;
    totalProfit: number;
  };
}

// ==================== NOTIFICATION TYPES ====================

export type NotificationType =
  | "sale"
  | "low_stock"
  | "stock_entry"
  | "promotion"
  | "credit_overdue"
  | "credit_payment"
  | "subscription"
  | "incident"
  | "achievement"
  | "ranking"
  | "system"
  | "reminder";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  _id: string;
  business: string;
  user?: string;
  targetRole?: "admin" | "distribuidor" | "all";
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  readAt?: string;
  link?: string;
  relatedEntity?: {
    type: string;
    id: string;
  };
  data?: Record<string, unknown>;
  expiresAt?: string;
  pushSent: boolean;
  createdAt?: string;
  updatedAt?: string;
}
