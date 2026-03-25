const { query } = require("../db");
const { randomUUID } = require("crypto");

async function createAnnouncement({
  author_id,
  role_context,
  title,
  body,
  channel_type,
  department_id,
  level_id,
  group_id
}) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO announcements (
      id, author_id, role_context, title, body, channel_type, department_id, level_id, group_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *;
  `,
    [id, author_id, role_context, title, body, channel_type, department_id, level_id, group_id]
  );
  return res.rows[0];
}

async function updateAnnouncementAI(id, { priority, summary, ai_score }) {
  const res = await query(
    `
    UPDATE announcements
    SET priority = $2, summary = $3, ai_score = $4, updated_at = now()
    WHERE id = $1
    RETURNING *;
  `,
    [id, priority || null, summary || null, ai_score ?? null]
  );
  return res.rows[0] || null;
}

async function getAnnouncementFeedForUser(user, { limit = 50, before } = {}) {
  const params = [];
  const scopeConditions = [];
  let beforeCondition = "";

  // SRS FIX: Scope conditions should be OR'd (user sees SCHOOL OR their dept/level OR their group)
  // But the 'before' pagination filter must be AND'd with ALL results
  scopeConditions.push(`(a.channel_type = 'SCHOOL')`);

  if (user.department_id) {
    params.push(user.department_id);
    const deptIdx = params.length;
    let levelCondition = "1=1"; // No level assigned? Show all in dept.
    if (user.level_id) {
      params.push(user.level_id);
      levelCondition = `(a.level_id IS NULL OR a.level_id = $${params.length})`;
    }
    scopeConditions.push(`(a.channel_type = 'DEPARTMENT_LEVEL' AND a.department_id = $${deptIdx} AND ${levelCondition})`);
  }

  if (user.group_id) {
    params.push(user.group_id);
    scopeConditions.push(`(a.channel_type = 'GROUP' AND a.group_id = $${params.length})`);
  }

  // The 'before' timestamp applies to ALL results, not a separate OR condition
  if (before) {
    params.push(before);
    beforeCondition = ` AND a.created_at < $${params.length}`;
  }

  params.push(Math.min(Number(limit) || 50, 100));

  const res = await query(
    `
    SELECT a.*
    FROM announcements a
    WHERE (${scopeConditions.join(" OR ")})${beforeCondition}
    ORDER BY a.created_at DESC
    LIMIT $${params.length};
  `,
    params
  );
  return res.rows;
}

async function getAllAnnouncementsForAudit({ limit = 100, before } = {}) {
  const params = [];
  let beforeCondition = "";

  if (before) {
    params.push(before);
    beforeCondition = `WHERE a.created_at < $${params.length}`;
  }

  params.push(Math.min(Number(limit) || 100, 200));

  const res = await query(
    `
    SELECT a.*, u.full_name as author_name, u.email as author_email
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    ${beforeCondition}
    ORDER BY a.created_at DESC
    LIMIT $${params.length};
  `,
    params
  );
  return res.rows;
}

module.exports = { createAnnouncement, updateAnnouncementAI, getAnnouncementFeedForUser, getAllAnnouncementsForAudit };

