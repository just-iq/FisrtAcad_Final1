import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Register the service worker and subscribe to Web Push.
 * Silently no-ops if the browser doesn't support it or permission is denied.
 */
export async function registerPushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    // Fetch the VAPID public key from the server
    const { key } = await api.getVapidPublicKey();
    if (!key) return;

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Check existing subscription first
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Already subscribed — re-save in case the server lost it
      await api.savePushSubscription(existing.toJSON()).catch(() => {});
      return;
    }

    // Ask the user for permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    await api.savePushSubscription(subscription.toJSON());
  } catch (err) {
    // Push is optional — never crash the app
    console.warn("Push notification setup failed:", err);
  }
}
