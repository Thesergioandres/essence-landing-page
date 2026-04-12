/**
 * Notification Types
 * Feature-Based Architecture
 */

export type NotificationType =
  | "sale"
  | "low_stock"
  | "stock_entry"
  | "promotion"
  | "credit_overdue"
  | "credit_payment"
  | "subscription"
  | "incident"
  | "achievement"
  | "ranking"
  | "system"
  | "reminder";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  _id: string;
  business: string;
  user?: string;
  targetRole?: "admin" | "employee" | "all";
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  readAt?: string;
  link?: string;
  relatedEntity?: {
    type: string;
    id: string;
  };
  data?: Record<string, unknown>;
  expiresAt?: string;
  pushSent: boolean;
  createdAt?: string;
  updatedAt?: string;
}
