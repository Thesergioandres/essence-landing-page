/**
 * Notification Services
 * Extracted from monolithic api/services.ts
 * Handles notifications and push subscriptions
 */

import api from "../../../api/axios";
import { isContextReady } from "../../../shared/utils/contextGuard";
import type {
  Notification,
  NotificationListResult,
  SendNotificationPayload,
} from "../types/notification.types";

// ==================== NOTIFICATION SERVICE ====================
const resolveBusinessId = (businessId?: string | null): string => {
  const explicitBusinessId =
    typeof businessId === "string" ? businessId.trim() : "";
  if (explicitBusinessId) {
    return explicitBusinessId;
  }

  const storedBusinessId =
    typeof window !== "undefined" ? localStorage.getItem("businessId") : null;
  return String(storedBusinessId || "").trim();
};

const requireBusinessId = (
  businessId: string | null | undefined,
  operation: string
): string => {
  const safeBusinessId = resolveBusinessId(businessId);
  if (!safeBusinessId) {
    throw new Error(`Falta businessId para ${operation}`);
  }
  return safeBusinessId;
};

const withBusinessHeader = (businessId: string) => ({
  headers: {
    "x-business-id": businessId,
  },
});

const hasActiveSession = (): boolean => {
  if (typeof window === "undefined") return true;
  return Boolean(localStorage.getItem("token"));
};

const resolveStatusCode = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

interface NotificationQueryParams {
  page?: number;
  limit?: number;
  businessId?: string | null;
}

const normalizeListResponse = (payload: any): NotificationListResult => {
  const notifications = payload?.data || payload?.notifications || [];
  const unreadCount =
    Number(payload?.unreadCount ?? payload?.count ?? payload?.unread ?? 0) || 0;

  return {
    notifications,
    unreadCount,
    pagination: payload?.pagination,
  };
};

export const notificationService = {
  async getPending(
    params?: NotificationQueryParams
  ): Promise<NotificationListResult> {
    if (!hasActiveSession() || !isContextReady()) {
      return { notifications: [], unreadCount: 0 };
    }

    const { businessId, ...queryParams } = params || {};
    const safeBusinessId = requireBusinessId(
      businessId,
      "obtener notificaciones pendientes"
    );

    const response = await api.get("/notifications/pending", {
      params: queryParams,
      ...withBusinessHeader(safeBusinessId),
    });
    return normalizeListResponse(response.data);
  },

  async getHistory(
    params?: NotificationQueryParams
  ): Promise<NotificationListResult> {
    if (!hasActiveSession() || !isContextReady()) {
      return { notifications: [], unreadCount: 0 };
    }

    const { businessId, ...queryParams } = params || {};
    const safeBusinessId = requireBusinessId(
      businessId,
      "obtener historial de notificaciones"
    );

    const response = await api.get("/notifications/history", {
      params: queryParams,
      ...withBusinessHeader(safeBusinessId),
    });
    return normalizeListResponse(response.data);
  },

  async send(payload: SendNotificationPayload): Promise<{
    message?: string;
    notification: Notification;
    targetCount: number;
  }> {
    const response = await api.post("/notifications/send", payload);
    const data = response.data || {};

    return {
      message: data.message,
      notification: data.data || data.notification,
      targetCount: Number(data.targetCount || 0),
    };
  },

  async markAsViewed(
    notificationId: string,
    businessId?: string | null
  ): Promise<Notification> {
    if (!hasActiveSession() || !isContextReady()) {
      throw new Error("No hay sesión activa o negocio seleccionado");
    }

    const safeBusinessId = requireBusinessId(
      businessId,
      "marcar notificación como vista"
    );

    try {
      const response = await api.put(
        `/notifications/${notificationId}/viewed`,
        undefined,
        withBusinessHeader(safeBusinessId)
      );
      return response.data?.data || response.data;
    } catch (error) {
      if (resolveStatusCode(error) === 404) {
        const fallbackResponse = await api.put(
          `/notifications/${notificationId}/read`,
          undefined,
          withBusinessHeader(safeBusinessId)
        );
        return fallbackResponse.data?.data || fallbackResponse.data;
      }

      throw error;
    }
  },

  async markAllAsViewed(
    businessId?: string | null
  ): Promise<{ modifiedCount: number }> {
    if (!hasActiveSession() || !isContextReady()) {
      return { modifiedCount: 0 };
    }

    const safeBusinessId = requireBusinessId(
      businessId,
      "marcar todas las notificaciones como vistas"
    );

    try {
      const response = await api.put(
        "/notifications/viewed-all",
        undefined,
        withBusinessHeader(safeBusinessId)
      );
      const payload = response.data?.data || response.data;

      return {
        modifiedCount: Number(payload?.modifiedCount || payload?.count || 0),
      };
    } catch (error) {
      if (resolveStatusCode(error) === 404) {
        const fallbackResponse = await api.put(
          "/notifications/read-all",
          undefined,
          withBusinessHeader(safeBusinessId)
        );
        const payload = fallbackResponse.data?.data || fallbackResponse.data;

        return {
          modifiedCount: Number(payload?.modifiedCount || payload?.count || 0),
        };
      }

      throw error;
    }
  },

  // Legacy compatibility
  async getAll(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    businessId?: string | null;
  }): Promise<NotificationListResult> {
    if (params?.unreadOnly) {
      return this.getPending(params);
    }

    return this.getHistory(params);
  },

  async getUnreadCount(businessId?: string | null): Promise<{
    count: number;
    unreadCount: number;
  }> {
    const result = await this.getPending({ limit: 1, businessId });
    return {
      count: result.unreadCount,
      unreadCount: result.unreadCount,
    };
  },

  async markAsRead(
    notificationId: string,
    businessId?: string | null
  ): Promise<Notification> {
    return this.markAsViewed(notificationId, businessId);
  },

  async markAllAsRead(
    businessId?: string | null
  ): Promise<{ modifiedCount: number }> {
    return this.markAllAsViewed(businessId);
  },

  async create(data: {
    title: string;
    message: string;
    recipientId?: string;
    recipientRole?: string;
    priority?: "low" | "medium" | "high" | "urgent";
  }): Promise<{
    notification: Notification;
    targetCount: number;
  }> {
    const sendToAll = data.recipientRole === "all" || !data.recipientId;

    const result = await this.send({
      title: data.title,
      message: data.message,
      sendToAll,
      targetEmployees: !sendToAll && data.recipientId ? [data.recipientId] : [],
      priority: data.priority,
    });

    return {
      notification: result.notification,
      targetCount: result.targetCount,
    };
  },
};

// ==================== PUSH SUBSCRIPTION SERVICE ====================
export const pushSubscriptionService = {
  async subscribe(payload: {
    subscription: PushSubscriptionJSON;
    preferences?: {
      sales?: boolean;
      stock?: boolean;
      credits?: boolean;
      subscriptions?: boolean;
    };
    userAgent?: string;
  }): Promise<{
    message: string;
  }> {
    const response = await api.post("/push/subscribe", payload);
    return response.data;
  },

  async unsubscribe(endpoint: string): Promise<{
    message: string;
  }> {
    const response = await api.post("/push/unsubscribe", { endpoint });
    return response.data;
  },

  async getVapidPublicKey(): Promise<{
    publicKey: string;
  }> {
    const response = await api.get("/push/vapid-key");
    return response.data?.data || response.data;
  },

  async getSubscriptions(): Promise<
    Array<{
      _id: string;
      preferences?: {
        sales?: boolean;
        stock?: boolean;
        credits?: boolean;
        subscriptions?: boolean;
      };
    }>
  > {
    const response = await api.get("/push/subscriptions");
    return response.data?.data?.subscriptions || [];
  },

  async updatePreferences(
    subscriptionId: string,
    preferences: {
      sales?: boolean;
      stock?: boolean;
      credits?: boolean;
      subscriptions?: boolean;
    }
  ): Promise<{ message: string }> {
    const response = await api.put(
      `/push/subscriptions/${subscriptionId}/preferences`,
      preferences
    );
    return response.data;
  },

  async testPush(): Promise<{
    message: string;
  }> {
    const response = await api.post("/push/test");
    return response.data;
  },
};
