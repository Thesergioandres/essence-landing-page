import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

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

const logApiError = (error: AxiosError) => {
  const status = error.response?.status;
  const url = error.config?.url;
  const method = error.config?.method;
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
    const businessId = localStorage.getItem("businessId");

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers) {
        delete (config.headers as Record<string, string>)["Content-Type"];
      }
    }

    const url = config.url || "";
    const allowsWithoutBusiness =
      url.startsWith("/auth") ||
      url.startsWith("/business/my-memberships") ||
      url.startsWith("/upload") ||
      url.startsWith("/users/god") ||
      url.startsWith("/issues") ||
      (config.method === "post" && url === "/business");

    if (token) {
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
    logApiError(error as AxiosError);

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const code = (error.response?.data as { code?: string } | undefined)?.code;

    if (error.response?.status === 403 && code === "owner_inactive") {
      localStorage.setItem("accessHoldReason", "owner_inactive");
      window.location.href = "/account-hold?reason=owner_inactive";
      return Promise.reject(error);
    }

    // Intentar refresh automático en 401 (excepto en rutas de auth)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/")
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
