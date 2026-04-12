/**
 * Analytics Feature Types
 * Feature-Based Architecture - Self-contained types
 */

// ==================== CREDIT METRICS TYPES ====================
export interface CreditMetrics {
  total: {
    totalCredits: number;
    totalRemainingAmount: number;
    totalPaidAmount: number;
    overdueCount: number;
    overdueAmount: number;
  };
  overdue: {
    count: number;
    amount: number;
  };
  recoveryRate: number | string;
  topDebtors?: Array<{
    customerId: string;
    customerName: string;
    totalDebt: number;
    creditsCount: number;
  }>;
  timeline?: Array<{
    date: string;
    created: number;
    paid: number;
    amount: number;
  }>;
  byStatus?: Record<string, number>;
  recentPayments?: Array<{
    id: string;
    amount: number;
    date: string;
    creditId: string;
  }>;
}

// ==================== DASHBOARD TYPES ====================
export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export interface KPI {
  value: number;
  change?: number;
  trend?: "up" | "down" | "neutral";
}

export interface DashboardStats {
  totalRevenue: number;
  totalNetProfit: number;
  totalSalesCount: number;
  averageTicket: number;
  salesTimeline: Array<{
    date: string;
    revenue: number;
    profit: number;
  }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface AnalyticsPayload {
  startDate?: string;
  endDate?: string;
  period?: "today" | "week" | "month" | "year";
}

// ==================== MONTHLY PROFIT TYPES ====================
export interface MonthlyProfitPeriod {
  adminProfit: number;
  employeeProfit: number;
  totalProfit: number;
  netProfit: number;
  netOperationProfit?: number;
  totalAdditionalCosts: number;
  totalShippingCosts: number;
  totalDiscounts: number;
  totalOPEX?: number;
  revenue: number;
  cost: number;
  salesCount: number;
  ordersCount: number;
  unitsCount: number;
}

export interface MonthlyProfitData {
  currentMonth: MonthlyProfitPeriod;
  lastMonth: MonthlyProfitPeriod;
  growthPercentage: number;
  averageTicket: number;
  _debug?: {
    nowUTC: string;
    nowColombia: string;
    startOfMonth: string;
    endOfMonth: string;
  };
}

// ==================== PROFIT HISTORY TYPES ====================
export interface ProfitHistoryEntry {
  id: string;
  saleId: string;
  date: string;
  source: "normal" | "special";
  type: "venta_admin" | "venta_empleado";
  productName: string;
  eventName?: string;
  quantity: number;
  salePrice: number;
  totalAmount: number;
  profit: number;
  profitPercentage: number;
  paymentStatus?: string;
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
  employeeId: string | null;
  employeeName: string;
  employeeEmail: string | null;
  type: "venta_empleado" | "venta_admin";
  adminProfit: number;
  employeeProfit: number;
  totalProfit: number;
  netProfit?: number;
  totalDeductions?: number;
  quantity: number;
  productName: string;
  eventName?: string;
  paymentStatus?: string;
}

export interface ProfitHistoryAdminEmployee {
  // Campos del backend
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  totalAdminProfit?: number;
  totalEmployeeProfit?: number;
  totalProfit?: number;
  salesCount?: number;
  quantitySold?: number;
  // Campos usados en el frontend (aliases)
  id: string;
  name: string;
  email?: string;
  sales?: number;
  employeeProfit?: number;
  adminProfit?: number;
}

export interface ProfitHistoryAdminOverview {
  // Campos originales
  totalAdminProfit?: number;
  totalEmployeeProfit?: number;
  totalProfit: number;
  grossProfit?: number;
  totalExpenses?: number;
  netProfit?: number;
  averageMargin?: number;
  salesCount?: number;
  employeeCount?: number;
  employeeBreakdown?: ProfitHistoryAdminEmployee[];
  // Campos del backend (getAdminOverview)
  totalEntries: number;
  totalEmployeeCommissions: number;
  employeeCommissionEntries: number;
  byType?: Record<string, { total: number; count: number }>;
  topUsers?: Array<{
    userId: string;
    userName: string;
    total: number;
    count: number;
  }>;
  recentEntries: ProfitHistoryAdminEntry[];
  entries?: ProfitHistoryAdminEntry[]; // Alias para compatibilidad
  employees?: ProfitHistoryAdminEmployee[]; // Lista de empleados
  filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  };
}

// ==================== FINANCIAL SUMMARY TYPES ====================
export interface Averages {
  avgAdminProfit: number;
  avgEmployeeProfit: number;
  avgTotalProfit: number;
  avgNetProfit?: number;
  avgQuantity: number;
  avgSalePrice: number;
}

export interface TimelineData {
  date: string;
  adminProfit: number;
  employeeProfit: number;
  totalProfit: number;
  netProfit?: number;
  salesCount: number;
  revenue?: number;
  profit?: number;
  sales?: number;
}

export interface FinancialSummary {
  totalAdminProfit: number;
  totalEmployeeProfit: number;
  totalProfit: number;
  totalNetProfit?: number;
  totalDeductions?: number;
  salesCount: number;
  quantitySold: number;
  averages: Averages;
  timeline: TimelineData[];
}

// ==================== COMPARATIVE ANALYSIS ====================
export interface UserBalance {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  totalEarnings: number;
  totalPaid: number;
  pendingBalance: number;
  salesCount: number;
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

// ==================== ANALYTICS DASHBOARD ====================
export interface AnalyticsDashboard {
  monthlyTotals: {
    totalRevenue: number;
    totalProfit: number;
    totalSales: number;
  };
  topProducts: Array<{
    _id: string;
    name: string;
    image?: { url: string; publicId?: string };
    totalQuantity: number;
    totalProfit: number;
  }>;
  topEmployees: Array<{
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

// ==================== EMPLOYEE PROFIT TYPES ====================
export interface EmployeeProfit {
  employeeId: string;
  employeeName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalProfit: number;
  totalAdminProfit: number;
  totalEmployeeProfit: number;
  totalSales?: number;
}
