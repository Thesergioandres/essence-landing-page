export interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "super_admin" | "distribuidor" | "god" | "user";
  business: string;
}

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  role: User["role"];
  business: string;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  role?: string;
  businessId?: string;
}
