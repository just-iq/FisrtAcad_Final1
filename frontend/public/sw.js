import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

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
