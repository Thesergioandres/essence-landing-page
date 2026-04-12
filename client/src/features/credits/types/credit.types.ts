/**
 * Credit Types
 * Feature-Based Architecture
 */

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
  customer:
    | { _id: string; name: string; phone?: string; email?: string }
    | string;
  business: string;
  sale?: unknown | string;
  branch?: { _id: string; name: string } | string;
  createdBy: { _id: string; name: string } | string;
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
  profitInfo?: CreditProfitInfo;
}

export interface CreditProfitInfo {
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isPaidCompletely: boolean;
  saleId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalSaleAmount: number;
  unitCost: number;
  totalCost: number;
  adminProfit: number;
  employeeProfit: number;
  totalProfit: number;
  employeeProfitPercentage: number;
  profitMarginPercentage: number;
  isEmployeeSale: boolean;
  employeeName?: string | null;
  employeeEmail?: string | null;
  amountEmployeeOwesToAdmin?: number;
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
  registeredBy: { _id: string; name: string; email?: string } | string | null;
  branch?: unknown | string;
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
    totalOriginalAmount?: number;
    totalRemainingAmount: number;
    totalPaidAmount: number;
    overdueCount?: number;
    overdueAmount?: number;
  };
  overdue: {
    count: number;
    amount: number;
  };
  byStatus?: Record<string, { count: number; amount: number }>;
  topDebtors?: Array<{
    customerId: string;
    customerName: string;
    customerPhone?: string;
    totalDebt: number;
    creditsCount: number;
  }>;
  recentPayments?: CreditPayment[];
  recoveryRate: number | string;
  timeline?: Array<{
    date: string;
    created: number;
    paid: number;
    amount: number;
  }>;
  paidCreditsProfit?: {
    count: number;
    totalAmount: number;
    adminProfit: number;
    employeeProfit: number;
    totalProfit: number;
  };
  pendingCreditsProfit?: {
    count: number;
    totalAmount: number;
    remainingAmount: number;
    adminProfit: number;
    employeeProfit: number;
    totalProfit: number;
  };
}
