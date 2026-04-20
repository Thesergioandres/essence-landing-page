/**
 * Auth Service
 * Extracted from monolithic api/services.ts
 * Handles authentication, user session, and profile management
 */

import api from "../../../api/axios";
import { normalizeEmployeeRole } from "../../../shared/utils/roleAliases";
import type {
  AuthResponse,
  Membership,
  RefreshTokenResponse,
  RegisterCredentials,
  User,
} from "../types/auth.types";

const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";

const resolveEntityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") {
      return null;
    }
    return trimmed;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
  };

  return (
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    null
  );
};

const normalizeSessionUser = <T extends User | AuthResponse>(user: T): T => {
  const record = (user || {}) as Record<string, unknown>;
  const normalizedRole = normalizeEmployeeRole(record.role as string);
  const normalizedUserId = resolveEntityId(record._id);
  const rawMemberships = Array.isArray(record.memberships)
    ? (record.memberships as Array<Record<string, unknown>>)
    : [];

  const normalizedMemberships = rawMemberships.map(membership => {
    const businessId = resolveEntityId(membership.business);
    const userId = resolveEntityId(membership.user);

    return {
      ...membership,
      role: normalizeEmployeeRole(membership.role as string),
      business:
        typeof membership.business === "string"
          ? businessId || membership.business
          : {
              ...(membership.business as Record<string, unknown>),
              ...(businessId ? { _id: businessId } : {}),
            },
      user:
        typeof membership.user === "string"
          ? userId || membership.user
          : membership.user && typeof membership.user === "object"
            ? {
                ...(membership.user as Record<string, unknown>),
                ...(userId ? { _id: userId } : {}),
              }
            : membership.user,
    };
  });

  const normalizedBusinessId =
    resolveEntityId(record.business) ||
    resolveEntityId(rawMemberships[0]?.business);

  return {
    ...(record as T),
    ...(normalizedUserId ? { _id: normalizedUserId } : {}),
    ...("business" in record
      ? {
          business:
            typeof record.business === "string"
              ? normalizedBusinessId || record.business
              : normalizedBusinessId,
        }
      : {}),
    ...(Array.isArray(record.memberships)
      ? { memberships: normalizedMemberships }
      : {}),
    ...(record.role ? { role: normalizedRole } : {}),
  };
};

const resolveBusinessIdFromUser = (user?: {
  memberships?: Membership[];
  business?: string;
}): string | null => {
  if (!user) return null;

  const membershipBusiness = user.memberships?.[0]?.business;
  return resolveEntityId(membershipBusiness) || resolveEntityId(user.business);
};

const applySession = (payload: {
  token: string;
  user: User | AuthResponse;
}) => {
  const normalizedUser = normalizeSessionUser(payload.user);

  localStorage.setItem("token", payload.token);
  localStorage.setItem("user", JSON.stringify(normalizedUser));
  const businessId = resolveBusinessIdFromUser(normalizedUser);
  if (businessId) {
    localStorage.setItem("businessId", businessId);
  } else {
    localStorage.removeItem("businessId");
  }
};

const notifySessionChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("auth-changed"));
  window.dispatchEvent(new Event("session-refresh"));
};

const toAuthResponse = (value: unknown): AuthResponse =>
  value as unknown as AuthResponse;

const hasUserIdentity = (value: Record<string, unknown>): boolean =>
  "_id" in value ||
  "id" in value ||
  "email" in value ||
  "role" in value ||
  "name" in value;

const mergeUserWithTokens = (
  userRecord: Record<string, unknown>,
  sourceRecord: Record<string, unknown>,
  fallbackRecord?: Record<string, unknown> | null
): AuthResponse => {
  const tokenFromSource =
    typeof sourceRecord.token === "string" ? sourceRecord.token : undefined;
  const tokenFromFallback =
    fallbackRecord && typeof fallbackRecord.token === "string"
      ? fallbackRecord.token
      : undefined;

  const refreshTokenFromSource =
    typeof sourceRecord.refreshToken === "string"
      ? sourceRecord.refreshToken
      : undefined;
  const refreshTokenFromFallback =
    fallbackRecord && typeof fallbackRecord.refreshToken === "string"
      ? fallbackRecord.refreshToken
      : undefined;

  const refreshExpiresAtFromSource =
    typeof sourceRecord.refreshExpiresAt === "string"
      ? sourceRecord.refreshExpiresAt
      : undefined;
  const refreshExpiresAtFromFallback =
    fallbackRecord && typeof fallbackRecord.refreshExpiresAt === "string"
      ? fallbackRecord.refreshExpiresAt
      : undefined;

  return {
    ...(toAuthResponse(userRecord) as AuthResponse),
    token: tokenFromSource || tokenFromFallback || "",
    ...(refreshTokenFromSource || refreshTokenFromFallback
      ? {
          refreshToken:
            refreshTokenFromSource || refreshTokenFromFallback || undefined,
        }
      : {}),
    ...(refreshExpiresAtFromSource || refreshExpiresAtFromFallback
      ? {
          refreshExpiresAt:
            refreshExpiresAtFromSource ||
            refreshExpiresAtFromFallback ||
            undefined,
        }
      : {}),
  } as unknown as AuthResponse;
};

const normalizeAuthResponse = (raw: unknown): AuthResponse => {
  const payload =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  if (hasUserIdentity(payload)) {
    return toAuthResponse(payload);
  }

  const nestedData =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;

  if (nestedData) {
    if (hasUserIdentity(nestedData)) {
      return toAuthResponse(nestedData);
    }

    const nestedUser =
      nestedData.user && typeof nestedData.user === "object"
        ? (nestedData.user as Record<string, unknown>)
        : null;

    if (nestedUser) {
      return mergeUserWithTokens(nestedUser, nestedData, payload);
    }
  }

  const directUser =
    payload.user && typeof payload.user === "object"
      ? (payload.user as Record<string, unknown>)
      : null;

  if (directUser) {
    return mergeUserWithTokens(directUser, payload);
  }

  return toAuthResponse(payload);
};

/**
 * Helper to set businessId for god users with single membership
 */
async function trySetBusinessForGod(role: string): Promise<void> {
  if (role !== "god") return;
  try {
    const { data } = await api.get<{
      success?: boolean;
      memberships?: Membership[];
      data?: { memberships?: Membership[] };
    }>("/business/my-memberships");
    const memberships = data?.memberships || data?.data?.memberships || [];
    const resolvedBusinessId = resolveEntityId(memberships[0]?.business);
    if (memberships.length === 1 && resolvedBusinessId) {
      localStorage.setItem("businessId", resolvedBusinessId);
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
    const user = normalizeSessionUser(response.data.data);
    localStorage.setItem("user", JSON.stringify(user));

    const businessId = resolveBusinessIdFromUser(user);
    if (businessId) {
      localStorage.setItem("businessId", businessId);
    }

    return user;
  },

  async register(payload: RegisterCredentials): Promise<AuthResponse> {
    const response = await api.post("/auth/register", payload);
    const authPayload = normalizeAuthResponse(response.data);

    // Guardar token para que el usuario pueda crear su negocio
    if (authPayload.token) {
      applySession({ token: authPayload.token, user: authPayload });
      if (authPayload.refreshToken) {
        localStorage.setItem("refreshToken", authPayload.refreshToken);
      }
      notifySessionChange();
    }

    return authPayload;
  },

  async selectPlan(plan: string) {
    const response = await api.patch<{
      success: boolean;
      data: {
        selectedPlan: string;
        selectedPlanAt: string;
      };
    }>("/auth/select-plan", { plan });

    const currentUserRaw = localStorage.getItem("user");
    if (currentUserRaw) {
      try {
        const currentUser = JSON.parse(currentUserRaw);
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...currentUser,
            selectedPlan: response.data.data.selectedPlan,
            selectedPlanAt: response.data.data.selectedPlanAt,
          })
        );
      } catch {
        // no-op
      }
    }

    return response.data.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    // Limpiar datos anteriores para evitar conflictos de sesión
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");

    const response = await api.post("/auth/login", {
      email,
      password,
    });
    const authPayload = normalizeAuthResponse(response.data);

    if (authPayload.token) {
      applySession({ token: authPayload.token, user: authPayload });
      if (authPayload.refreshToken) {
        localStorage.setItem("refreshToken", authPayload.refreshToken);
      }
      await trySetBusinessForGod(normalizeEmployeeRole(authPayload.role));
      notifySessionChange();
    }

    return authPayload;
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
          const normalizedUser = normalizeSessionUser(response.data.user);
          localStorage.setItem("user", JSON.stringify(normalizedUser));

          const businessId = resolveBusinessIdFromUser(normalizedUser);
          if (businessId) {
            localStorage.setItem("businessId", businessId);
          }
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
    notifySessionChange();
  },

  isImpersonating(): boolean {
    return Boolean(localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY));
  },

  async impersonate(employeeId: string): Promise<void> {
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
    }>(`/auth/impersonate/${employeeId}`);

    const payload = (response.data as any)?.data ?? response.data;
    if (!payload?.token || !payload?.user) {
      throw new Error("Respuesta inválida al suplantar empleado");
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
    const userRaw = localStorage.getItem("user");
    if (!userRaw) return null;

    try {
      const parsedUser = JSON.parse(userRaw) as AuthResponse & {
        token: string;
      };
      const normalizedUser = normalizeSessionUser(
        parsedUser
      ) as AuthResponse & {
        token: string;
      };

      localStorage.setItem("user", JSON.stringify(normalizedUser));

      const resolvedBusinessId = resolveBusinessIdFromUser(normalizedUser);
      const currentBusinessId = resolveEntityId(
        localStorage.getItem("businessId")
      );

      if (resolvedBusinessId && currentBusinessId !== resolvedBusinessId) {
        localStorage.setItem("businessId", resolvedBusinessId);
      }

      if (!resolvedBusinessId && !currentBusinessId) {
        localStorage.removeItem("businessId");
      }

      return normalizedUser;
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },

  hasRefreshToken(): boolean {
    return !!localStorage.getItem("refreshToken");
  },

  getDashboardRoute(role?: string | null): string {
    const normalizedRole = normalizeEmployeeRole(role);

    if (normalizedRole === "employee") {
      return "/staff/dashboard";
    }

    if (
      normalizedRole === "admin" ||
      normalizedRole === "super_admin" ||
      normalizedRole === "god"
    ) {
      return "/admin/analytics";
    }

    return "/";
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
