const { query } = require("../db");
const { randomUUID } = require("crypto");

async function createMessage({ sender_id, sender_role, channel_type, department_id, level_id, group_id, body }) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO messages (id, sender_id, sender_role, channel_type, department_id, level_id, group_id, body)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `,
    [id, sender_id, sender_role, channel_type, department_id, level_id, group_id, body]
  );
  return res.rows[0];
}

async function listMessagesForUser(user, { limit = 50, before } = {}) {
  const params = [];
  const scopeConditions = [];
  let beforeCondition = "";

  // SRS FIX: Scope conditions should be OR'd (user sees their dept/level OR their group)
  // But the 'before' pagination filter must be AND'd with ALL results
  if (user.department_id && user.level_id) {
    params.push(user.department_id, user.level_id);
    scopeConditions.push(
      `(m.channel_type = 'DEPARTMENT_LEVEL' AND m.department_id = $${params.length - 1} AND m.level_id = $${params.length})`
    );
  }

  if (user.group_id) {
    params.push(user.group_id);
    scopeConditions.push(`(m.channel_type = 'GROUP' AND m.group_id = $${params.length})`);
  }

  if (!scopeConditions.length) return [];

  // The 'before' timestamp applies to ALL results, not a separate OR condition
  if (before) {
    params.push(before);
    beforeCondition = ` AND m.created_at < $${params.length}`;
  }

  params.push(Math.min(Number(limit) || 50, 100));

  const res = await query(
    `
    SELECT m.*
    FROM messages m
    WHERE (${scopeConditions.join(" OR ")})${beforeCondition}
    ORDER BY m.created_at DESC
    LIMIT $${params.length};
  `,
    params
  );
  return res.rows;
}

module.exports = { createMessage, listMessagesForUser };

