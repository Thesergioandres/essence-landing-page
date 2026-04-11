/**
 * Push Notification Service
 * Maneja registro de service worker y suscripciones push
 */

import { pushSubscriptionService } from "./notification.service";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

/**
 * Obtiene la clave VAPID del servidor si no está configurada localmente
 */
async function getVapidPublicKey(): Promise<string> {
  if (VAPID_PUBLIC_KEY) {
    return VAPID_PUBLIC_KEY;
  }

  try {
    const data = await pushSubscriptionService.getVapidPublicKey();
    return data?.publicKey || "";
  } catch (error) {
    console.error("[UI ERROR] Failed to fetch VAPID key:", error);
  }

  return "";
}

/**
 * Verifica si el navegador soporta notificaciones push
 */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Registra el service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("[UI WARN] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("[UI INFO] Service worker registered:", registration.scope);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error("[UI ERROR] Service worker registration failed:", error);
    return null;
  }
}

/**
 * Solicita permiso para notificaciones
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("[UI WARN] Notifications not supported");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    console.warn("[UI WARN] Notifications blocked by user");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    console.log("[UI INFO] Notification permission:", permission);
    return permission;
  } catch (error) {
    console.error(
      "[UI ERROR] Failed to request notification permission:",
      error
    );
    return "denied";
  }
}

/**
 * Convierte una clave VAPID base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray as Uint8Array<ArrayBuffer>;
}

/**
 * Suscribe al usuario a notificaciones push
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  const vapidKey = await getVapidPublicKey();

  if (!vapidKey) {
    console.warn("[UI WARN] VAPID public key not configured");
    return null;
  }

  try {
    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log("[UI INFO] Existing push subscription found");
      return subscription;
    }

    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    console.log("[UI INFO] Push subscription created");

    // Send subscription to server
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error("[UI ERROR] Failed to subscribe to push:", error);
    return null;
  }
}

/**
 * Desuscribe de notificaciones push
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return true;
    }

    // Notify server
    await removeSubscriptionFromServer(subscription);

    // Unsubscribe
    const result = await subscription.unsubscribe();
    console.log("[UI INFO] Push unsubscribed:", result);

    return result;
  } catch (error) {
    console.error("[UI ERROR] Failed to unsubscribe from push:", error);
    return false;
  }
}

/**
 * Envía la suscripción al servidor
 */
async function sendSubscriptionToServer(
  subscription: PushSubscription
): Promise<void> {
  try {
    await pushSubscriptionService.subscribe({
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
      preferences: {
        sales: true,
        stock: true,
        credits: true,
        subscriptions: true,
        gamification: true,
      },
    });

    console.log("[UI INFO] Subscription saved to server");
  } catch (error) {
    console.error("[UI ERROR] Failed to save subscription:", error);
  }
}

/**
 * Elimina la suscripción del servidor
 */
async function removeSubscriptionFromServer(
  subscription: PushSubscription
): Promise<void> {
  try {
    await pushSubscriptionService.unsubscribe(subscription.endpoint);

    console.log("[UI INFO] Subscription removed from server");
  } catch (error) {
    console.error("[UI ERROR] Failed to remove subscription:", error);
  }
}

/**
 * Muestra una notificación local (sin push server)
 */
export function showLocalNotification(
  title: string,
  options: NotificationOptions = {}
): void {
  if (Notification.permission !== "granted") {
    console.warn("[UI WARN] Notification permission not granted");
    return;
  }

  const defaultOptions: NotificationOptions & { vibrate?: number[] } = {
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    ...options,
  };

  new Notification(title, defaultOptions as NotificationOptions);
}

/**
 * Inicializa el sistema de notificaciones push
 */
export async function initPushNotifications(): Promise<{
  registration: ServiceWorkerRegistration | null;
  subscription: PushSubscription | null;
  permission: NotificationPermission;
}> {
  const result = {
    registration: null as ServiceWorkerRegistration | null,
    subscription: null as PushSubscription | null,
    permission: "default" as NotificationPermission,
  };

  if (!isPushSupported()) {
    console.warn("[UI WARN] Push notifications not supported");
    return result;
  }

  // Register service worker
  result.registration = await registerServiceWorker();

  if (!result.registration) {
    return result;
  }

  // Request permission
  result.permission = await requestNotificationPermission();

  if (result.permission !== "granted") {
    return result;
  }

  // Subscribe to push
  result.subscription = await subscribeToPush(result.registration);

  return result;
}
