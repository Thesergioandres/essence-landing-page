export interface User {
  _id: string;
  name: string;
  email: string;
  role:
    | "admin"
    | "super_admin"
    | "employee"
    | "employee"
    | "employee"
    | "god"
    | "user";
  status?: "pending" | "active" | "expired" | "suspended" | "paused";
  subscriptionExpiresAt?: string | null;
  active?: boolean;
  phone?: string;
  address?: string;
  business?: string;
  memberships?: Membership[];
  assignedProducts?: string[];
  selectedPlan?: "starter" | "pro" | "enterprise" | null;
  selectedPlanAt?: string | null;
  HIDE_FINANCIAL_DATA?: boolean;
  hideFinancialData?: boolean;
  fixedCommissionOnly?: boolean;
  isCommissionFixed?: boolean;
  customCommissionRate?: number | null;
  token?: string;
}

export interface Membership {
  _id: string;
  business: {
    _id: string;
    name: string;
    description?: string;
    config?: import("../../business/types/business.types").BusinessConfig;
    status?: import("../../business/types/business.types").Business["status"];
    logoUrl?: string;
  };
  user:
    | {
        _id: string;
        name: string;
        email: string;
        fixedCommissionOnly?: boolean;
        isCommissionFixed?: boolean;
        customCommissionRate?: number | null;
      }
    | string
    | null;
  role: string;
  status: string;
  permissions?: Record<string, Record<string, boolean>>;
}

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  role: User["role"];
  status?: User["status"];
  active?: boolean;
  subscriptionExpiresAt?: string;
  business?: string;
  memberships?: Membership[];
  selectedPlan?: User["selectedPlan"];
  selectedPlanAt?: User["selectedPlanAt"];
  HIDE_FINANCIAL_DATA?: boolean;
  hideFinancialData?: boolean;
  token: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  logo?: { url: string; publicId: string } | null;
  role?: string;
  businessId?: string;
}
