import { Bell, BellOff, Check, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { pushSubscriptionService } from "../features/notifications/services";

interface PushPreferences {
  sales: boolean;
  stock: boolean;
  credits: boolean;
  subscriptions: boolean;
}

export default function PushNotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>({
    sales: true,
    stock: true,
    credits: true,
    subscriptions: true,
  });
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    checkSupport();
    checkSubscription();
  }, []);

  const checkSupport = () => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(isSupported);
    if (isSupported) {
      setPermission(Notification.permission);
    }
  };

  const checkSubscription = async () => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(!!subscription);
    } catch {
      setSubscribed(false);
    }
  };

  const requestPermission = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await subscribe();
      }
    } catch (error) {
      console.error("[UI ERROR] push_permission_failed", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async () => {
    setLoading(true);
    try {
      // Registrar service worker si no está registrado
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Obtener la clave pública VAPID del servidor
      const config = await pushSubscriptionService.getVapidPublicKey();

      // Crear suscripción push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });

      // Enviar suscripción al servidor
      await pushSubscriptionService.subscribe({
        subscription: subscription.toJSON(),
        preferences,
        userAgent: navigator.userAgent,
      });

      setSubscribed(true);
      console.log("[UI INFO] push_subscribed");
    } catch (error) {
      console.error("[UI ERROR] push_subscribe_failed", error);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await pushSubscriptionService.unsubscribe(subscription.endpoint);
      }

      setSubscribed(false);
      console.log("[UI INFO] push_unsubscribed");
    } catch (error) {
      console.error("[UI ERROR] push_unsubscribe_failed", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPrefs: Partial<PushPreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);

    if (subscribed) {
      try {
        const subscriptions = await pushSubscriptionService.getSubscriptions();
        const activeSubscriptionId = subscriptions?.[0]?._id;
        if (activeSubscriptionId) {
          await pushSubscriptionService.updatePreferences(
            activeSubscriptionId,
            updated
          );
        }
        console.log("[UI INFO] push_preferences_updated");
      } catch (error) {
        console.error("[UI ERROR] push_preferences_update_failed", error);
      }
    }
  };

  // Utilidad para convertir base64 a Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (!supported) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3 text-gray-500">
          <BellOff className="h-5 w-5" />
          <span className="text-sm">
            Las notificaciones push no están soportadas en este navegador
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {subscribed ? (
            <Bell className="h-6 w-6 text-green-500" />
          ) : (
            <BellOff className="h-6 w-6 text-gray-400" />
          )}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Notificaciones Push
            </h3>
            <p className="text-sm text-gray-500">
              {subscribed
                ? "Recibirás alertas en tiempo real"
                : permission === "denied"
                  ? "Notificaciones bloqueadas en el navegador"
                  : "Activa para recibir alertas importantes"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subscribed && (
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Configurar preferencias"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}

          {permission === "denied" ? (
            <span className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Bloqueado
            </span>
          ) : (
            <button
              onClick={subscribed ? unsubscribe : requestPermission}
              disabled={loading}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                subscribed
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Procesando...
                </span>
              ) : subscribed ? (
                "Desactivar"
              ) : (
                "Activar Notificaciones"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Panel de preferencias */}
      {showPreferences && subscribed && (
        <div className="mt-4 border-t pt-4 dark:border-gray-700">
          <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Tipos de notificaciones
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { key: "sales", label: "Nuevas ventas", icon: "💰" },
              { key: "stock", label: "Stock bajo", icon: "📦" },
              { key: "credits", label: "Créditos por vencer", icon: "💳" },
              { key: "subscriptions", label: "Membresías", icon: "👤" },
            ].map(({ key, label, icon }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span>{icon}</span>
                  {label}
                </span>
                <button
                  onClick={() =>
                    updatePreferences({
                      [key]: !preferences[key as keyof PushPreferences],
                    })
                  }
                  className={`rounded-full p-1 ${
                    preferences[key as keyof PushPreferences]
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-400 dark:bg-gray-700"
                  }`}
                >
                  {preferences[key as keyof PushPreferences] ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
