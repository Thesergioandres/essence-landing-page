import { useCallback, useEffect, useState } from "react";
import {
  initPushNotifications,
  isPushSupported,
  showLocalNotification,
  unsubscribeFromPush,
} from "../features/notifications/services/pushNotification.service";

interface UsePushNotificationsResult {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  showNotification: (title: string, options?: NotificationOptions) => void;
}

/**
 * Hook para gestionar notificaciones push
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported] = useState(() => isPushSupported());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  // Check initial state
  useEffect(() => {
    if (!isSupported) return;

    const checkState = async () => {
      try {
        setPermission(Notification.permission);

        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          setRegistration(reg);

          const subscription = await reg.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        }
      } catch (err) {
        console.error("[UI ERROR] Failed to check push state:", err);
      }
    };

    checkState();
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications not supported");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await initPushNotifications();

      setRegistration(result.registration);
      setPermission(result.permission);
      setIsSubscribed(!!result.subscription);

      if (result.permission === "denied") {
        setError("Notifications blocked. Please enable in browser settings.");
      } else if (!result.subscription) {
        setError("Failed to subscribe to push notifications");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[UI ERROR] Push subscription failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!registration) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await unsubscribeFromPush(registration);
      setIsSubscribed(!success);

      if (!success) {
        setError("Failed to unsubscribe");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[UI ERROR] Push unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  // Show local notification
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission !== "granted") {
        console.warn(
          "[UI WARN] Cannot show notification - permission not granted"
        );
        return;
      }
      showLocalNotification(title, options);
    },
    [permission]
  );

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    showNotification,
  };
}
