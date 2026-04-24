import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

const resolveEntityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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

const inferBusinessIdFromStoredUser = (): string | null => {
  try {
    const userRaw = localStorage.getItem("user");
    if (!userRaw) {
      return null;
    }

    const user = JSON.parse(userRaw) as {
      business?: unknown;
      memberships?: Array<{ business?: unknown; status?: unknown }>;
    };

    // ALWAYS PREFER DIRECT BUSINESS ID FOR EMPLOYEES
    const directBusinessId = resolveEntityId(user.business);
    if (directBusinessId) {
      return directBusinessId;
    }

    const membershipIds = (
      Array.isArray(user.memberships)
        ? user.memberships
            .filter(membership => {
              const status =
                typeof membership?.status === "string"
                  ? membership.status.toLowerCase()
                  : "";
              return status !== "pending" && status !== "suspended";
            })
            .map(membership => resolveEntityId(membership.business))
            .filter((id): id is string => Boolean(id))
        : []
    ) as string[];

    const uniqueMembershipIds = Array.from(new Set(membershipIds));
    if (uniqueMembershipIds.length > 0) {
      return uniqueMembershipIds[0];
    }

    return null;
  } catch {
    return null;
  }
};

const resolveBusinessIdForRequest = (
  explicitBusinessId: string | null
): string | null => {
  if (explicitBusinessId) {
    return explicitBusinessId;
  }

  const storedBusinessId = localStorage.getItem("businessId");
  if (storedBusinessId && storedBusinessId.trim().length > 0) {
    return storedBusinessId.trim();
  }

  const inferredBusinessId = inferBusinessIdFromStoredUser();
  if (inferredBusinessId) {
    localStorage.setItem("businessId", inferredBusinessId);
    return inferredBusinessId;
  }

  return null;
};

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return "http://localhost:5000/api/v2";
  }

  return "https://essence-backend-production-25b3.up.railway.app/api/v2";
};

const apiBaseUrl = getApiBaseUrl();

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Flag para evitar loops infinitos de refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const logApiError = (error: AxiosError | Error) => {
  if (error.message === "Debes seleccionar un negocio antes de continuar") {
    return;
  }

  if (!axios.isAxiosError(error)) {
    console.error("[API ERROR]", {
      message: error.message,
    });
    return;
  }

  const status = error.response?.status;
  const url = error.config?.url;
  const method = error.config?.method;
  const isSessionBootstrapEndpoint =
    typeof url === "string" &&
    (url.startsWith("/business/my-memberships") ||
      url.startsWith("/business/me/memberships") ||
      url.startsWith("/auth/profile"));
  const isPublicSettingsEndpoint =
    typeof url === "string" && url.includes("/global-settings/public");
  const isExpectedForbiddenEndpoint =
    status === 403 &&
    typeof url === "string" &&
    (url.includes("/advanced-analytics/") || url.startsWith("/providers"));
  const isExpectedSessionBootstrapAuthError =
    (status === 401 || status === 403) && isSessionBootstrapEndpoint;

  if (status === 401 && isPublicSettingsEndpoint) {
    return;
  }

  if (isExpectedSessionBootstrapAuthError) {
    return;
  }

  if (isExpectedForbiddenEndpoint) {
    return;
  }

  const requestId =
    (error.response?.headers?.["x-request-id"] as string | undefined) ||
    (error.response?.data as { requestId?: string } | undefined)?.requestId;

  // Consola detallada para depurar fallos en frontend
  console.error("[API ERROR]", {
    url,
    method,
    status,
    requestId,
    message: error.message,
    data: error.response?.data,
  });
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");

    const rawBusinessHeader =
      (config.headers?.["x-business-id"] as string | undefined) ||
      (config.headers?.["X-Business-Id"] as string | undefined);
    const explicitBusinessId =
      typeof rawBusinessHeader === "string" && rawBusinessHeader.trim().length
        ? rawBusinessHeader.trim()
        : null;
    const businessId = resolveBusinessIdForRequest(explicitBusinessId);

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers) {
        delete (config.headers as Record<string, string>)["Content-Type"];
      }
    }

    const url = config.url || "";
    const isPublicSettingsEndpoint = url.startsWith("/global-settings/public");
    const isAuthEndpoint =
      url.startsWith("/auth/login") ||
      url.startsWith("/auth/register") ||
      url.startsWith("/auth/refresh");

    const allowsWithoutBusiness =
      url.startsWith("/auth") ||
      url.startsWith("/business/my-memberships") ||
      url.startsWith("/public/") ||
      url.startsWith("/upload") ||
      url.startsWith("/users/god") ||
      url.startsWith("/issues") ||
      isPublicSettingsEndpoint ||
      (config.method === "post" && url === "/business");

    if (token && !isPublicSettingsEndpoint && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!businessId && token && !allowsWithoutBusiness) {
      return Promise.reject(
        new Error("Debes seleccionar un negocio antes de continuar")
      );
    }

    if (businessId) {
      config.headers["x-business-id"] = businessId;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  response => response,
  async error => {
    logApiError(error as AxiosError | Error);

    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & {
          _retry?: boolean;
        })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const code = (error.response?.data as { code?: string } | undefined)?.code;

    if (
      error.response?.status === 403 &&
      (code === "owner_inactive" || code === "SUBSCRIPTION_INACTIVE")
    ) {
      localStorage.setItem("accessHoldReason", code);
      window.location.href = `/account-hold?reason=${code}`;
      return Promise.reject(error);
    }

    // Intentar refresh automático en 401 (excepto en rutas de auth)
    const isPublicSettings401 = originalRequest.url?.includes(
      "/global-settings/public"
    );

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/") &&
      !isPublicSettings401
    ) {
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        if (isRefreshing) {
          // Si ya estamos refrescando, encolar esta request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              if (token && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            })
            .catch(err => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post(`${apiBaseUrl}/auth/refresh`, {
            refreshToken,
          });

          const { token: newToken, refreshToken: newRefreshToken } =
            response.data;

          localStorage.setItem("token", newToken);
          localStorage.setItem("refreshToken", newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          processQueue(null, newToken);

          console.log("[UI INFO] Token refreshed successfully");

          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          console.error("[UI ERROR] Token refresh failed, logging out");

          // Limpiar todo y redirigir a login
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          localStorage.removeItem("businessId");
          window.location.href = "/login";

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No hay refresh token, limpiar y redirigir a login si había token
        const token = localStorage.getItem("token");
        if (token) {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          localStorage.removeItem("businessId");
          window.location.href = "/login";
        }
      }
    } else if (
      error.response?.status === 401 &&
      originalRequest.url?.includes("/auth/")
    ) {
      // Error 401 en rutas de auth (login/register/refresh) - no redirigir, solo rechazar
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
