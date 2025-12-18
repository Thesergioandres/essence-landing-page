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
  role: "user" | "admin" | "distribuidor";
  active?: boolean;
  phone?: string;
  address?: string;
  assignedProducts?: string[] | Product[];
  token?: string;
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

export interface Sale {
  _id: string;
  saleId: string;
  distributor: User | string;
  product: Product | string;
  quantity: number;
  purchasePrice: number;
  distributorPrice: number;
  salePrice: number;
  distributorProfit: number;
  adminProfit: number;
  totalProfit: number;
  distributorProfitPercentage?: number;
  notes?: string;
  saleDate: string;
  paymentStatus: "pendiente" | "confirmado";
  paymentConfirmedAt?: string;
  paymentConfirmedBy?: User | string;
  paymentProof?: string;
  paymentProofMimeType?: string;
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
  | "keep";

export interface BusinessAssistantRecommendationAction {
  action: BusinessAssistantActionType;
  title: string;
  confidence?: number;
  suggestedQty?: number;
  suggestedChangePct?: number;
  details?: {
    targetDays?: number;
    avgDailyUnits?: number;
    daysCover?: number;
  };
}

export interface BusinessAssistantRecommendationItem {
  productId: string;
  productName: string;
  categoryId: string | null;
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
    avgDailyUnits: number;
    daysCover: number | null;
    recentAvgPrice: number;
    categoryAvgPrice: number;
    priceVsCategoryPct: number;
  };
  recommendation: {
    primary: BusinessAssistantRecommendationAction | null;
    actions: BusinessAssistantRecommendationAction[];
    justification: string[];
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
}

export interface StockAlert {
  warehouseAlerts: Product[];
  distributorAlerts: DistributorStock[];
}

export interface DefectiveProduct {
  _id: string;
  distributor?: User | string | null; // Opcional: null cuando es reporte de admin desde bodega
  product: Product | string;
  quantity: number;
  reason: string;
  images?: ProductImage[];
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
