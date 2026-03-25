const webpush = require("web-push");
const { query } = require("../db");

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@firstacad.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Save (or update) a push subscription for a user
 */
async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return;

  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE
       SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, endpoint, keys.p256dh, keys.auth]
  );
}

/**
 * Remove a specific subscription (called when push returns 410 Gone)
 */
async function removeSubscription(endpoint) {
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

/**
 * Send a push notification to all subscriptions for a user
 */
async function sendToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const res = await query(
    `SELECT * FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  const notification = JSON.stringify(payload);

  for (const row of res.rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    };
    try {
      await webpush.sendNotification(subscription, notification);
    } catch (err) {
      // 410 Gone = subscription expired/revoked — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeSubscription(row.endpoint).catch(() => {});
      }
    }
  }
}

module.exports = { saveSubscription, sendToUser };
