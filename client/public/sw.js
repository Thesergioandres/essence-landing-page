/// <reference lib="webworker" />

const CACHE_NAME = "essence-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install event - cache static assets
self.addEventListener("install", event => {
  console.warn("[Essence Debug]", "[SW] Installing service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.warn("[Essence Debug]", "[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener("activate", event => {
  console.warn("[Essence Debug]", "[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.warn("[Essence Debug]", "[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", event => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API calls (let them go to network)
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

// Push notification event
self.addEventListener("push", event => {
  console.warn("[Essence Debug]", "[SW] Push notification received");

  let data = {
    title: "Essence",
    body: "Nueva notificaciÃ³n",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "default",
    data: { url: "/" },
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Cerrar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event
self.addEventListener("notificationclick", event => {
  console.warn("[Essence Debug]", "[SW] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clientList => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event
self.addEventListener("sync", event => {
  console.warn("[Essence Debug]", "[SW] Background sync:", event.tag);

  if (event.tag === "sync-sales") {
    event.waitUntil(syncPendingSales());
  }
  if (event.tag === "sync-stock") {
    event.waitUntil(syncPendingStock());
  }
});

// Sync pending sales when back online
async function syncPendingSales() {
  try {
    const cache = await caches.open("pending-sales");
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      const data = await response.json();

      await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      await cache.delete(request);
    }
    console.warn("[Essence Debug]", "[SW] Pending sales synced");
  } catch (error) {
    console.error("[SW] Failed to sync sales:", error);
  }
}

// Sync pending stock updates when back online
async function syncPendingStock() {
  try {
    const cache = await caches.open("pending-stock");
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      const data = await response.json();

      await fetch("/api/stock/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      await cache.delete(request);
    }
    console.warn("[Essence Debug]", "[SW] Pending stock synced");
  } catch (error) {
    console.error("[SW] Failed to sync stock:", error);
  }
}

