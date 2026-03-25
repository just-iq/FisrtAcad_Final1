const { query } = require("../db");
const { randomUUID } = require("crypto");

/**
 * Create a direct message
 */
async function createDM({ sender_id, receiver_id, body }) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO direct_messages (id, sender_id, receiver_id, body)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
    `,
    [id, sender_id, receiver_id, body]
  );
  return res.rows[0];
}

/**
 * Get a single DM by ID
 */
async function getDMById(id) {
  const res = await query(`SELECT * FROM direct_messages WHERE id = $1;`, [id]);
  return res.rows[0] || null;
}

/**
 * Get conversation between two users
 */
async function getConversation(userId, otherUserId, { limit = 50, before = null } = {}) {
  const params = [userId, otherUserId, Math.min(Number(limit) || 50, 100)];
  let beforeCondition = "";
  
  if (before) {
    params.push(before);
    beforeCondition = ` AND dm.created_at < $${params.length}`;
  }
  
  const res = await query(
    `
    SELECT dm.*, 
           sender.full_name as sender_name, sender.email as sender_email,
           receiver.full_name as receiver_name, receiver.email as receiver_email
    FROM direct_messages dm
    JOIN users sender ON dm.sender_id = sender.id
    JOIN users receiver ON dm.receiver_id = receiver.id
    WHERE (
      (dm.sender_id = $1 AND dm.receiver_id = $2) OR 
      (dm.sender_id = $2 AND dm.receiver_id = $1)
    )${beforeCondition}
    ORDER BY dm.created_at DESC
    LIMIT $3;
    `,
    params
  );
  return res.rows;
}

/**
 * List all conversations for a user (returns latest message from each conversation)
 */
async function listConversations(userId) {
  const res = await query(
    `
    WITH ranked_messages AS (
      SELECT 
        dm.*,
        CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END as other_user_id,
        ROW_NUMBER() OVER (
          PARTITION BY 
            CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END
          ORDER BY dm.created_at DESC
        ) as rn
      FROM direct_messages dm
      WHERE dm.sender_id = $1 OR dm.receiver_id = $1
    )
    SELECT 
      rm.*,
      u.full_name as other_user_name,
      u.email as other_user_email,
      (
        SELECT COUNT(*)::int 
        FROM direct_messages 
        WHERE receiver_id = $1 
          AND sender_id = rm.other_user_id 
          AND read_at IS NULL
      ) as unread_count
    FROM ranked_messages rm
    JOIN users u ON rm.other_user_id = u.id
    WHERE rm.rn = 1
    ORDER BY rm.created_at DESC;
    `,
    [userId]
  );
  return res.rows;
}

/**
 * Mark a DM as read
 */
async function markAsRead(dmId, userId) {
  const res = await query(
    `
    UPDATE direct_messages
    SET read_at = now()
    WHERE id = $1 AND receiver_id = $2 AND read_at IS NULL
    RETURNING *;
    `,
    [dmId, userId]
  );
  return res.rows[0] || null;
}

/**
 * Mark all messages from a sender as read
 */
async function markConversationAsRead(userId, otherUserId) {
  const res = await query(
    `
    UPDATE direct_messages
    SET read_at = now()
    WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL
    RETURNING id;
    `,
    [userId, otherUserId]
  );
  return res.rows.length;
}

/**
 * Get total unread DM count for a user
 */
async function getUnreadCount(userId) {
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM direct_messages WHERE receiver_id = $1 AND read_at IS NULL;`,
    [userId]
  );
  return res.rows[0]?.count || 0;
}

/**
 * Get user info for DM
 */
async function getUserForDM(userId) {
  const res = await query(
    `SELECT id, full_name, email, department_id, level_id, group_id FROM users WHERE id = $1 AND is_active = true;`,
    [userId]
  );
  return res.rows[0] || null;
}

/**
 * List potential DM recipients (students for staff, or staff for students)
 */
async function listPotentialRecipients(user, { search = "", limit = 50 } = {}) {
  const roles = user.roles || [];
  const isStaff = roles.some(r => ["LECTURER", "COURSE_REP", "STUDENT_EXEC", "ADMIN"].includes(r));
  
  let roleFilter;
  if (isStaff) {
    // Staff can message students in their scope
    roleFilter = `
      EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = u.id AND r.name IN ('STUDENT', 'COURSE_REP', 'STUDENT_EXEC')
      )
    `;
  } else {
    // Students can only see/reply to staff who have messaged them
    return [];
  }
  
  const params = [user.id];
  let searchCondition = "";
  if (search) {
    params.push(`%${search}%`);
    searchCondition = ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }
  params.push(Math.min(Number(limit) || 50, 100));
  
  // Scope filter for same department/level
  let scopeCondition = "";
  if (user.department_id) {
    params.push(user.department_id);
    scopeCondition += ` AND u.department_id = $${params.length}`;
  }
  if (user.level_id) {
    params.push(user.level_id);
    scopeCondition += ` AND u.level_id = $${params.length}`;
  }
  
  const res = await query(
    `
    SELECT u.id, u.full_name, u.email
    FROM users u
    WHERE u.id != $1 
      AND u.is_active = true
      AND ${roleFilter}
      ${searchCondition}
      ${scopeCondition}
    ORDER BY u.full_name ASC
    LIMIT $${params.indexOf(Math.min(Number(limit) || 50, 100)) + 1};
    `,
    params
  );
  return res.rows;
}

module.exports = {
  createDM,
  getDMById,
  getConversation,
  listConversations,
  markAsRead,
  markConversationAsRead,
  getUnreadCount,
  getUserForDM,
  listPotentialRecipients
};
