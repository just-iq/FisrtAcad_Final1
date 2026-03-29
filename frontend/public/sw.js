import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

precacheAndRoute(self.__WB_MANIFEST);

// Background sync for failed requests
const bgSyncPlugin = new BackgroundSyncPlugin('offline-queue', {
  maxRetentionTime: 24 * 60, // 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (response.ok) {
          // Success - notify the app
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                data: { url: entry.request.url }
              });
            });
          });
        } else {
          // Re-queue if still failing
          await queue.unshiftRequest(entry);
          break;
        }
      } catch (error) {
        // Network error - re-queue
        await queue.unshiftRequest(entry);
        break;
      }
    }
  }
});

// Cache API responses with NetworkFirst strategy for dynamic data
registerRoute(
  ({ url }) => {
    // Cache requests to your backend API (hosted on Render)
    const apiUrl = new URL(import.meta.env?.VITE_API_URL || 'https://firstacad-final1.onrender.com');
    const shouldCache = url.origin === apiUrl.origin ||
           url.origin.includes('firstacad-final1.onrender.com');
    return shouldCache;
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
      bgSyncPlugin
    ],
  })
);

// Cache static assets with CacheFirst for better performance
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Handle sync events for background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncPendingActions());
  }
});

// Function to sync pending actions
async function syncPendingActions() {
  try {
    // Get pending actions from IndexedDB (this will be called from the main thread)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_PENDING_ACTIONS'
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Service Worker lifecycle events
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('Service Worker claimed all clients');
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {}

  const icons = {
    CLASS_REMINDER: "📅",
    ASSIGNMENT_DEADLINE: "📝",
    ANNOUNCEMENT: "📢",
    SYSTEM: "🔔",
  };

  const title = data.title ?? "FirstAcad";
  const body = data.message ?? "";
  const url = data.url ?? "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.type ?? "general",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
