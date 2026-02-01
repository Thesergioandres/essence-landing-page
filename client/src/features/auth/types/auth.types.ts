export interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "super_admin" | "distribuidor" | "god" | "user";
  status?: "pending" | "active" | "expired" | "suspended" | "paused";
  subscriptionExpiresAt?: string | null;
  active?: boolean;
  phone?: string;
  address?: string;
  business?: string;
  memberships?: Membership[];
  assignedProducts?: string[];
  token?: string;
}

export interface Membership {
  _id: string;
  business: {
    _id: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
    status?: string;
    logoUrl?: string;
  };
  user: string;
  role: string;
  status: string;
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
