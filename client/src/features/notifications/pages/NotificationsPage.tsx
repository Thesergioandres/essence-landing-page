import { useCallback, useEffect, useState } from "react";
import { notificationService } from "../../notifications/services";
import type { Notification, NotificationType } from "../../../types";
import { logUI } from "../../../utils/logger";

const typeIcons: Record<NotificationType, string> = {
  sale: "💰",
  low_stock: "📦",
  stock_entry: "📥",
  promotion: "🎉",
  credit_overdue: "⚠️",
  credit_payment: "💳",
  subscription: "📋",
  incident: "🚨",
  achievement: "🏆",
  ranking: "📊",
  system: "⚙️",
  reminder: "🔔",
};

const typeLabels: Record<NotificationType, string> = {
  sale: "Venta",
  low_stock: "Stock Bajo",
  stock_entry: "Entrada Stock",
  promotion: "Promoción",
  credit_overdue: "Fiado Vencido",
  credit_payment: "Pago Fiado",
  subscription: "Suscripción",
  incident: "Incidencia",
  achievement: "Logro",
  ranking: "Ranking",
  system: "Sistema",
  reminder: "Recordatorio",
};

const priorityColors = {
  low: "border-gray-200",
  medium: "border-blue-200",
  high: "border-orange-200",
  urgent: "border-red-300",
};

interface NotificationsProps {
  asDropdown?: boolean;
  onClose?: () => void;
}

export default function Notifications({
  asDropdown = false,
  onClose,
}: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getAll({
        read: filter === "unread" ? false : undefined,
        limit: asDropdown ? 10 : 50,
      });
      setNotifications(res.notifications);
      logUI.info("Notificaciones cargadas", {
        module: "notifications",
        count: res.notifications.length,
      });
    } catch (err) {
      logUI.error("Error al cargar notificaciones", {
        module: "notifications",
        error: err,
      });
    } finally {
      setLoading(false);
    }
  }, [filter, asDropdown]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n =>
          n._id === id
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      logUI.error("Error al marcar como leída", {
        module: "notifications",
        error: err,
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      logUI.info("Todas las notificaciones marcadas como leídas", {
        module: "notifications",
      });
    } catch (err) {
      logUI.error("Error al marcar todas como leídas", {
        module: "notifications",
        error: err,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.delete(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      logUI.error("Error al eliminar notificación", {
        module: "notifications",
        error: err,
      });
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (asDropdown) {
    return (
      <div className="w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-gray-900">Notificaciones</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Marcar todas leídas
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No hay notificaciones
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification._id}
                className={`cursor-pointer border-b border-gray-50 px-4 py-3 transition-colors hover:bg-gray-50 ${
                  !notification.read ? "bg-indigo-50/50" : ""
                }`}
                onClick={() => {
                  if (!notification.read) handleMarkAsRead(notification._id);
                  if (notification.link) {
                    window.location.href = notification.link;
                    onClose?.();
                  }
                }}
              >
                <div className="flex gap-3">
                  <span className="text-xl">
                    {typeIcons[notification.type] || "📢"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${!notification.read ? "font-semibold" : ""} truncate text-gray-900`}
                    >
                      {notification.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-gray-500">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <span className="mt-2 h-2 w-2 rounded-full bg-indigo-600"></span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2">
          <a
            href="/notifications"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            onClick={onClose}
          >
            Ver todas las notificaciones
          </a>
        </div>
      </div>
    );
  }

  // Full page view
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="mt-1 text-sm text-gray-600">
            {unreadCount > 0 ? `${unreadCount} sin leer` : "Todas leídas"}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as "all" | "unread")}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas</option>
            <option value="unread">Sin leer</option>
          </select>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="rounded-lg px-4 py-2 text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              Marcar todas leídas
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No hay notificaciones
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification._id}
              className={`border-l-4 p-4 transition-colors hover:bg-gray-50 ${
                priorityColors[notification.priority]
              } ${!notification.read ? "bg-indigo-50/30" : ""}`}
            >
              <div className="flex gap-4">
                <span className="text-2xl">
                  {typeIcons[notification.type] || "📢"}
                </span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-sm ${!notification.read ? "font-semibold" : ""} text-gray-900`}
                        >
                          {notification.title}
                        </h3>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {typeLabels[notification.type]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification._id)}
                          className="p-1 text-gray-400 hover:text-indigo-600"
                          title="Marcar como leída"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification._id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Eliminar"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {notification.link && (
                    <a
                      href={notification.link}
                      className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Ver detalles →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
