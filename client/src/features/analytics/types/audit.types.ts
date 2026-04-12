/**
 * Audit Log Types
 * Feature-Based Architecture
 */

export interface AuditLog {
  _id: string;
  user: { _id: string; name: string; email: string } | string;
  userEmail?: string;
  userName?: string;
  userRole?: "admin" | "employee" | "user";
  action: string;
  module?: string;
  resourceType?: string;
  resourceId?: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity?: "info" | "warning" | "error" | "critical";
  createdAt: string | Date;
  updatedAt?: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  currentPage: number;
  totalPages: number;
  totalLogs: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  actions?: string[];
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
  summary?: {
    totalActions: number;
    uniqueUsers: number;
    byAction: Array<{ action: string; count: number }>;
    byResourceType: Array<{ type: string; count: number }>;
    byUser: Array<{ userId: string; userName: string; count: number }>;
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
  stats?: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  recentActivity?: Array<{
    _id: string;
    action: string;
    user: string;
    createdAt: Date;
  }>;
}
