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

const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";

const resolveBusinessIdFromUser = (user?: {
  memberships?: Membership[];
  business?: string;
}): string | null => {
  if (!user) return null;
  return user.memberships?.[0]?.business?._id || user.business || null;
};

const applySession = (payload: {
  token: string;
  user: User | AuthResponse;
}) => {
  localStorage.setItem("token", payload.token);
  localStorage.setItem("user", JSON.stringify(payload.user));
  const businessId = resolveBusinessIdFromUser(payload.user);
  if (businessId) {
    localStorage.setItem("businessId", businessId);
  }
};

const notifySessionChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("auth-changed"));
  window.dispatchEvent(new Event("session-refresh"));
};

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
  hasToken: (): boolean => !!localStorage.getItem("token"),

  syncSession: async (): Promise<User | null> => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const response = await api.get<{ success: boolean; data: User }>(
      "/auth/profile"
    );
    const user = response.data.data;
    localStorage.setItem("user", JSON.stringify(user));
    return user;
  },

  async register(payload: RegisterCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", payload);

    // Guardar token para que el usuario pueda crear su negocio
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
    localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-changed"));
    }
  },

  isImpersonating(): boolean {
    return Boolean(localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY));
  },

  async impersonate(distributorId: string): Promise<void> {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) {
      throw new Error("No hay sesión activa para iniciar suplantación");
    }

    const originalSavedToken = localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY);
    if (!originalSavedToken) {
      localStorage.setItem(ADMIN_ORIGINAL_TOKEN_KEY, currentToken);
    }

    const response = await api.post<{
      success: boolean;
      token: string;
      user: User;
    }>(`/auth/impersonate/${distributorId}`);

    const payload = (response.data as any)?.data ?? response.data;
    if (!payload?.token || !payload?.user) {
      throw new Error("Respuesta inválida al suplantar distribuidor");
    }

    applySession({ token: payload.token, user: payload.user });
    localStorage.removeItem("refreshToken");
    notifySessionChange();

    if (typeof window !== "undefined") {
      window.location.reload();
    }
  },

  async revertImpersonation(): Promise<void> {
    const adminOriginalToken = localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY);
    if (!adminOriginalToken) {
      throw new Error("No hay sesión original de admin para restaurar");
    }

    const response = await api.post<{
      success: boolean;
      token: string;
      user: User;
    }>("/auth/impersonate/revert", {
      adminOriginalToken,
    });

    const payload = (response.data as any)?.data ?? response.data;
    if (!payload?.token || !payload?.user) {
      throw new Error("Respuesta inválida al restaurar sesión");
    }

    applySession({ token: payload.token, user: payload.user });
    localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);
    localStorage.removeItem("refreshToken");
    notifySessionChange();

    if (typeof window !== "undefined") {
      window.location.reload();
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
    const response = await api.get<{ success: boolean; data: User }>(
      "/auth/profile"
    );
    return response.data.data;
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
