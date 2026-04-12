import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

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

const AXIOS_DEBUG_PREFIX = "[Essence Debug] | axios.ts |";

const logAxiosWarn = (action: string, details?: unknown) => {
  console.warn(`${AXIOS_DEBUG_PREFIX} ${action}`, details);
};

const logAxiosError = (action: string, details?: unknown) => {
  console.error(`${AXIOS_DEBUG_PREFIX} ${action}`, details);
};

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
    logAxiosWarn("Request bloqueada por falta de negocio seleccionado", {
      message: error.message,
    });
    return;
  }

  if (!axios.isAxiosError(error)) {
    logAxiosError("Error no-Axios en interceptor", {
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
  const isExpectedEmployeeFallbackNotFound =
    status === 404 &&
    method === "get" &&
    typeof url === "string" &&
    (url.startsWith("/employees") || url.startsWith("/employees"));
  const isExpectedSessionBootstrapAuthError =
    (status === 401 || status === 403) && isSessionBootstrapEndpoint;
  const isExpectedSessionBootstrapRateLimit =
    status === 429 && isSessionBootstrapEndpoint;

  if (status === 401 && isPublicSettingsEndpoint) {
    logAxiosWarn("401 esperado en global-settings/public", {
      url,
      method,
      status,
    });
    return;
  }

  if (status === 429 && isPublicSettingsEndpoint) {
    logAxiosWarn("429 en global-settings/public", {
      url,
      method,
      status,
    });
    return;
  }

  if (isExpectedSessionBootstrapRateLimit) {
    logAxiosWarn("Rate limit durante bootstrap de sesion", {
      url,
      method,
      status,
    });
    return;
  }

  if (isExpectedEmployeeFallbackNotFound) {
    logAxiosWarn("404 esperado en fallback employees/employees", {
      url,
      method,
      status,
    });
    return;
  }

  if (isExpectedSessionBootstrapAuthError) {
    logAxiosWarn("Auth error esperado durante bootstrap de sesion", {
      url,
      method,
      status,
    });
    return;
  }

  if (isExpectedForbiddenEndpoint) {
    logAxiosWarn("403 esperado por permisos/plan", {
      url,
      method,
      status,
    });
    return;
  }

  const requestId =
    (error.response?.headers?.["x-request-id"] as string | undefined) ||
    (error.response?.data as { requestId?: string } | undefined)?.requestId;

  // Consola detallada para depurar fallos en frontend
  logAxiosError("Error de API no esperado", {
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
    const businessId = localStorage.getItem("businessId");

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
      logAxiosWarn("Request rechazada por ausencia de x-business-id", {
        url,
        method: config.method,
      });
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
      logAxiosWarn("Error de respuesta sin request original", {
        message: (error as { message?: string })?.message,
      });
      return Promise.reject(error);
    }

    const code = (error.response?.data as { code?: string } | undefined)?.code;

    if (error.response?.status === 403 && code === "owner_inactive") {
      logAxiosWarn("Redireccion por owner_inactive", {
        url: originalRequest.url,
        status: error.response?.status,
      });
      localStorage.setItem("accessHoldReason", "owner_inactive");
      window.location.href = "/account-hold?reason=owner_inactive";
      return Promise.reject(error);
    }

    // Intentar refresh automÃ¡tico en 401 (excepto en rutas de auth)
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
              logAxiosWarn(
                "Fallo request encolada durante refresh compartido",
                err
              );
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post(`${apiBaseUrl}/auth/refresh`, {
            refreshToken,
          });

          const currentRefreshToken = localStorage.getItem("refreshToken");
          if (!currentRefreshToken || currentRefreshToken !== refreshToken) {
            throw new Error("Session changed during token refresh");
          }

          const { token: newToken, refreshToken: newRefreshToken } =
            response.data;

          localStorage.setItem("token", newToken);
          localStorage.setItem("refreshToken", newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          processQueue(null, newToken);

          console.warn("[Essence Debug]", "[UI INFO] Token refreshed successfully");

          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          logAxiosError("Fallo refresh token; cerrando sesion", refreshError);

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
        // No hay refresh token, limpiar y redirigir a login si habÃ­a token
        const token = localStorage.getItem("token");
        if (token) {
          logAxiosWarn("401 sin refresh token disponible; limpiando sesion", {
            url: originalRequest.url,
          });
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
      logAxiosWarn("401 en endpoint de auth", {
        url: originalRequest.url,
        status: error.response?.status,
      });
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;

