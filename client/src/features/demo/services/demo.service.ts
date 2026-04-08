import api from "../../../api/axios";
import type { User } from "../../auth/types/auth.types";

const DEMO_SESSION_KEY = "demo-sandbox-active";
const DEMO_EXPIRES_AT_KEY = "demo-sandbox-expires-at";
const DEMO_BUSINESS_ID_KEY = "demo-sandbox-business-id";
const DEMO_MODE_KEY = "demo-mode";
const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";

type DemoSetupPayload = {
  token: string;
  user: User;
  businessId: string;
  businessName: string;
  expiresAt: string;
  seeded: Record<string, number>;
};

type DemoSetupResponse = {
  success: boolean;
  data: DemoSetupPayload;
  message?: string;
};

type DemoTeardownResponse = {
  success: boolean;
  data?: {
    deleted: boolean;
    reason?: string;
    deletedCounts?: Record<string, number>;
  };
  message?: string;
};

const emitSessionEvents = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("auth-changed"));
  window.dispatchEvent(new Event("session-refresh"));
};

const setDemoFlags = (payload: DemoSetupPayload) => {
  localStorage.setItem(DEMO_SESSION_KEY, "1");
  localStorage.setItem(DEMO_EXPIRES_AT_KEY, payload.expiresAt);
  localStorage.setItem(DEMO_BUSINESS_ID_KEY, payload.businessId);
  localStorage.setItem(DEMO_MODE_KEY, "1");
};

const clearDemoFlags = () => {
  localStorage.removeItem(DEMO_SESSION_KEY);
  localStorage.removeItem(DEMO_EXPIRES_AT_KEY);
  localStorage.removeItem(DEMO_BUSINESS_ID_KEY);
  localStorage.removeItem(DEMO_MODE_KEY);
};

export const demoService = {
  async setupSandbox(): Promise<DemoSetupPayload> {
    const response = await api.post<DemoSetupResponse>("/demo/setup");
    return response.data.data;
  },

  async teardownSandbox(): Promise<DemoTeardownResponse["data"]> {
    const response = await api.delete<DemoTeardownResponse>("/demo/teardown");
    return response.data.data;
  },

  applySandboxSession(payload: DemoSetupPayload) {
    localStorage.setItem("token", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("businessId", payload.businessId);
    localStorage.removeItem("refreshToken");
    localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);
    setDemoFlags(payload);
    emitSessionEvents();
  },

  clearSandboxSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");
    localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);
    clearDemoFlags();
    emitSessionEvents();
  },

  isDemoSession(): boolean {
    return localStorage.getItem(DEMO_SESSION_KEY) === "1";
  },

  getDemoExpiry(): string | null {
    return localStorage.getItem(DEMO_EXPIRES_AT_KEY);
  },
};
