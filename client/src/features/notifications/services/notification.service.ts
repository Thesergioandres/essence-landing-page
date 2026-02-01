/**
 * Notification Services
 * Extracted from monolithic api/services.ts
 * Handles notifications and push subscriptions
 */

import api from "../../../api/axios";
import type { Notification } from "../../../types";

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
  }> {
    const response = await api.get("/notifications/unread-count");
    return response.data;
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
  async subscribe(subscription: PushSubscriptionJSON): Promise<{
    message: string;
  }> {
    const response = await api.post("/push/subscribe", subscription);
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
    const response = await api.get("/push/vapid-public-key");
    return response.data;
  },

  async testPush(): Promise<{
    message: string;
  }> {
    const response = await api.post("/push/test");
    return response.data;
  },
};
