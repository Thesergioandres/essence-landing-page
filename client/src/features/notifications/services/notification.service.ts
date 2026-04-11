/**
 * Notification Services
 * Extracted from monolithic api/services.ts
 * Handles notifications and push subscriptions
 */

import api from "../../../api/axios";
import type { Notification } from "../types/notification.types";

// ==================== NOTIFICATION SERVICE ====================
export const notificationService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  }): Promise<{
    notifications: Notification[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    unreadCount: number;
  }> {
    const response = await api.get("/notifications", { params });
    return response.data;
  },

  async getUnreadCount(): Promise<{
    count: number;
    unreadCount: number;
  }> {
    const response = await api.get("/notifications/unread-count");
    // Ensure both properties are available
    return {
      count: response.data.count ?? response.data.unreadCount ?? 0,
      unreadCount: response.data.unreadCount ?? response.data.count ?? 0,
    };
  },

  async markAsRead(notificationId: string): Promise<{
    message: string;
    notification: Notification;
  }> {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  async markAllAsRead(): Promise<{
    message: string;
    count: number;
  }> {
    const response = await api.put("/notifications/read-all");
    return response.data;
  },

  async create(data: {
    type: string;
    title: string;
    message: string;
    recipientId?: string;
    recipientRole?: string;
    data?: Record<string, any>;
    priority?: "low" | "medium" | "high";
  }): Promise<{
    message: string;
    notification: Notification;
  }> {
    const response = await api.post("/notifications", data);
    return response.data;
  },

  async delete(notificationId: string): Promise<{
    message: string;
  }> {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  async cleanup(olderThanDays?: number): Promise<{
    message: string;
    deletedCount: number;
  }> {
    const response = await api.delete("/notifications/cleanup", {
      params: { days: olderThanDays },
    });
    return response.data;
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
      gamification?: boolean;
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
        gamification?: boolean;
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
      gamification?: boolean;
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
