const { query } = require("../db");
const { randomUUID } = require("crypto");

/**
 * Create a new notification for a user
 */
async function createNotification({ user_id, type, title, message, related_id = null, scheduled_for }) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO user_notifications (id, user_id, type, title, message, related_id, scheduled_for)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
    `,
    [id, user_id, type, title, message, related_id, scheduled_for]
  );
  return res.rows[0];
}

/**
 * Create multiple notifications in a batch
 */
async function createNotificationsBatch(notifications) {
  if (!notifications.length) return [];
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const n of notifications) {
    const id = randomUUID();
    values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    params.push(id, n.user_id, n.type, n.title, n.message, n.related_id || null, n.scheduled_for);
  }
  
  const res = await query(
    `
    INSERT INTO user_notifications (id, user_id, type, title, message, related_id, scheduled_for)
    VALUES ${values.join(", ")}
    RETURNING *;
    `,
    params
  );
  return res.rows;
}

/**
 * Get notifications for a user with optional filtering
 */
async function getNotificationsForUser(userId, { unreadOnly = false, limit = 50, before = null } = {}) {
  const params = [userId, Math.min(Number(limit) || 50, 100)];
  let conditions = "user_id = $1";
  
  if (unreadOnly) {
    conditions += " AND read_at IS NULL";
  }
  
  if (before) {
    params.push(before);
    conditions += ` AND scheduled_for < $${params.length}`;
  }
  
  const res = await query(
    `
    SELECT *
    FROM user_notifications
    WHERE ${conditions}
    ORDER BY scheduled_for DESC
    LIMIT $2;
    `,
    params
  );
  return res.rows;
}

/**
 * Mark a notification as read
 */
async function markAsRead(notificationId, userId) {
  const res = await query(
    `
    UPDATE user_notifications
    SET read_at = now()
    WHERE id = $1 AND user_id = $2
    RETURNING *;
    `,
    [notificationId, userId]
  );
  return res.rows[0] || null;
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
  const res = await query(
    `
    UPDATE user_notifications
    SET read_at = now()
    WHERE user_id = $1 AND read_at IS NULL
    RETURNING id;
    `,
    [userId]
  );
  return res.rows.length;
}

/**
 * Get count of unread notifications
 */
async function getUnreadCount(userId) {
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM user_notifications WHERE user_id = $1 AND read_at IS NULL;`,
    [userId]
  );
  return res.rows[0]?.count || 0;
}

/**
 * Delete old notifications (for cleanup)
 */
async function deleteOldNotifications(olderThanDays = 30) {
  const res = await query(
    `
    DELETE FROM user_notifications
    WHERE created_at < NOW() - INTERVAL '1 day' * $1
    RETURNING id;
    `,
    [olderThanDays]
  );
  return res.rows.length;
}

/**
 * Check if a notification already exists (to avoid duplicates).
 * Returns the existing row (or null) so callers can re-use it.
 */
async function notificationExists(userId, type, relatedId, scheduledFor) {
  // Match on the date portion only so re-running on the same day doesn't create duplicates
  const res = await query(
    `
    SELECT * FROM user_notifications
    WHERE user_id = $1 AND type = $2 AND related_id = $3
      AND scheduled_for::date = $4::date
    LIMIT 1;
    `,
    [userId, type, relatedId, scheduledFor]
  );
  return res.rows[0] || null;
}

module.exports = {
  createNotification,
  createNotificationsBatch,
  getNotificationsForUser,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteOldNotifications,
  notificationExists
};
