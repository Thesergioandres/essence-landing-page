/**
 * Auth Service
 * Extracted from monolithic api/services.ts
 * Handles authentication, user session, and profile management
 */

import api from "../../../api/axios";
import type {
  AuthResponse,
  Membership,
  RefreshTokenResponse,
  RegisterCredentials,
  User,
} from "../types/auth.types";

/**
 * Helper to set businessId for god users with single membership
 */
async function trySetBusinessForGod(role: string): Promise<void> {
  if (role !== "god") return;
  try {
    const { data } = await api.get<{ memberships: Membership[] }>(
      "/business/me/memberships"
    );
    const memberships = data?.memberships || [];
    if (memberships.length === 1 && memberships[0]?.business?._id) {
      localStorage.setItem("businessId", memberships[0].business._id);
    }
  } catch (error) {
    console.warn("No se pudo asignar businessId para god", error);
  }
}

export const authService = {
  async register(payload: RegisterCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", payload);

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
      if (response.data.refreshToken) {
        localStorage.setItem("refreshToken", response.data.refreshToken);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-changed"));
      }
    }

    return response.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    // Limpiar datos anteriores para evitar conflictos de sesión
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");

    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
      if (response.data.refreshToken) {
        localStorage.setItem("refreshToken", response.data.refreshToken);
      }
      await trySetBusinessForGod(response.data.role);
      if (typeof window !== "undefined") {
        // Disparar evento de cambio de auth para refrescar contextos
        window.dispatchEvent(new Event("auth-changed"));
        // Disparar evento personalizado para forzar refresh de business context
        window.dispatchEvent(
          new CustomEvent("session-refresh", {
            detail: { role: response.data.role, userId: response.data._id },
          })
        );
      }
    }

    return response.data;
  },

  async refreshToken(): Promise<{
    token: string;
    refreshToken: string;
  } | null> {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    try {
      const response = await api.post<RefreshTokenResponse>("/auth/refresh", {
        refreshToken,
      });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("refreshToken", response.data.refreshToken);
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
      }

      return {
        token: response.data.token,
        refreshToken: response.data.refreshToken,
      };
    } catch (error) {
      // Si falla el refresh, limpiar tokens
      console.error("[UI ERROR] Token refresh failed", error);
      localStorage.removeItem("refreshToken");
      return null;
    }
  },

  logout(): void {
    const refreshToken = localStorage.getItem("refreshToken");

    // Intentar revocar el refresh token en el servidor
    if (refreshToken) {
      api.post("/auth/logout", { refreshToken }).catch(() => {
        // Ignorar errores de logout
      });
    }

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-changed"));
    }
  },

  getCurrentUser(): (AuthResponse & { token: string }) | null {
    const user = localStorage.getItem("user");
    return user ? (JSON.parse(user) as AuthResponse & { token: string }) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },

  hasRefreshToken(): boolean {
    return !!localStorage.getItem("refreshToken");
  },

  async getProfile(): Promise<User> {
    const response = await api.get<User>("/auth/profile");
    return response.data;
  },

  async getAllUsers(): Promise<{ success: boolean; data: User[] }> {
    const response = await api.get("/users");
    return response.data;
  },
};

export const userService = {
  async findByEmail(email: string): Promise<User> {
    const response = await api.get<{ user: User }>(`/users/find/${email}`);
    return response.data.user;
  },
};

// Re-export types for convenience
export type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
} from "../types/auth.types";
