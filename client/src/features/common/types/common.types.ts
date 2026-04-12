/**
 * Common Types (Expense, IssueReport, DefectiveProduct)
 * Feature-Based Architecture
 */

export interface Expense {
  _id: string;
  type: string;
  category?: string;
  amount: number;
  description?: string;
  expenseDate: string;
  product?: string | { _id: string; name?: string } | null;
  quantity?: number | null;
  sourceType?: "warehouse" | "branch" | "employee" | null;
  sourceBranch?: string | { _id: string; name?: string } | null;
  sourceEmployee?: string | { _id: string; name?: string } | null;
  createdBy?: unknown | string;
  createdAt?: string;
  updatedAt?: string;
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
  user?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface DefectiveProduct {
  _id: string;
  employee?: { _id: string; name: string; email?: string } | string | null;
  branch?: { _id: string; name: string } | string | null;
  product:
    | { _id: string; name: string; image?: { url: string; publicId?: string } }
    | string
    | null;
  quantity: number;
  reason: string;
  images?: Array<{ url: string; publicId: string }>;
  hasWarranty?: boolean;
  warrantyStatus?: "pending" | "approved" | "rejected" | "not_applicable";
  lossAmount?: number;
  stockRestored?: boolean;
  stockRestoredAt?: string;
  status: "pendiente" | "confirmado" | "rechazado";
  reportDate: string;
  confirmedAt?: string;
  confirmedBy?: unknown | string;
  adminNotes?: string;
  saleGroupId?: string;
  origin?: "direct" | "order" | "customer_warranty";
  ticketId?: string;
  originalSaleId?: string;
  originalSaleGroupId?: string;
  originalSaleItem?: unknown | string;
  originalSaleDate?: string;
  originalSalePrice?: number;
  replacementProduct?:
    | { _id: string; name: string; image?: { url: string; publicId?: string } }
    | string
    | null;
  replacementQuantity?: number;
  replacementPrice?: number;
  replacementTotal?: number;
  priceDifference?: number;
  cashRefund?: number;
  warrantyResolution?: "pending" | "scrap" | "supplier_warranty";
  warrantyResolvedAt?: string;
  warrantyResolvedBy?: unknown | string;
  createdAt?: string;
  updatedAt?: string;
}
