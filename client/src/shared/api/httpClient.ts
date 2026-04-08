import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

// Environment Configuration
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return "http://localhost:5000/api";
  }

  return "https://essence-backend-production-25b3.up.railway.app/api/v2";
};

const apiBaseUrl = getApiBaseUrl();

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// --- Refresh Token Logic ---
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

// --- Error Logger ---
const logApiError = (error: AxiosError) => {
  const status = error.response?.status;
  const url = error.config?.url;
  const method = error.config?.method;
  const isPublicSettingsEndpoint =
    typeof url === "string" && url.includes("/global-settings/public");
  const isExpectedForbiddenEndpoint =
    status === 403 &&
    typeof url === "string" &&
    (url.includes("/advanced-analytics/") || url.startsWith("/providers"));

  if (status === 401 && isPublicSettingsEndpoint) {
    return;
  }
  if (isExpectedForbiddenEndpoint) {
    return;
  }
  //   const requestId =
  //     (error.response?.headers?.["x-request-id"] as string | undefined) ||
  //     (error.response?.data as { requestId?: string } | undefined)?.requestId;

  if (import.meta.env.DEV) {
    console.error("[API ERROR]", {
      url,
      method,
      status,
      //   requestId,
      message: error.message,
      data: error.response?.data,
    });
  }
};

// --- Request Interceptor ---
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    const businessId = localStorage.getItem("businessId");

    const url = config.url || "";
    const isPublicSettingsEndpoint = url.startsWith("/global-settings/public");
    const isAuthEndpoint =
      url.startsWith("/auth/login") ||
      url.startsWith("/auth/register") ||
      url.startsWith("/auth/refresh");

    // Allow public or generic routes without strict business check
    const allowsWithoutBusiness =
      url.startsWith("/auth") ||
      url.startsWith("/business/my-memberships") ||
      url.startsWith("/upload") ||
      url.startsWith("/users/god") ||
      url.startsWith("/issues") ||
      isPublicSettingsEndpoint ||
      (config.method === "post" && url === "/business");

    if (token && !isPublicSettingsEndpoint && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!businessId && token && !allowsWithoutBusiness) {
      // In Refactor: clearer error or redirect logic might be needed
      return Promise.reject(new Error("No Business Context Selected"));
    }

    if (businessId) {
      config.headers["x-business-id"] = businessId;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// --- Response Interceptor ---
httpClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    logApiError(error);

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Legacy Code check (keep for backward compat)
    const data = error.response?.data as { code?: string } | undefined;
    const code = data?.code;

    // Handle Owner Inactive
    if (error.response?.status === 403 && code === "owner_inactive") {
      localStorage.setItem("accessHoldReason", "owner_inactive");
      window.location.href = "/account-hold?reason=owner_inactive";
      return Promise.reject(error);
    }

    // Handle 401 Refresh
    const isPublicSettings401 = originalRequest.url?.includes(
      "/global-settings/public"
    );

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth") &&
      !isPublicSettings401 // works for /auth and /v2/auth checks
    ) {
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              if (token && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return httpClient(originalRequest);
            })
            .catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Use standard axios for refresh to avoid interceptor loop
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
          return httpClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);

          // Logout sequence
          localStorage.clear();
          window.location.href = "/login";

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token available
        const token = localStorage.getItem("token");
        if (token) {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);
