const { query } = require("../db");
const { randomUUID } = require("crypto");

async function createResource(r) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO resources (
      id, lecturer_id, title, description, file_key, file_url, mime_type, size_bytes, department_id, level_id, group_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `,
    [
      id,
      r.lecturer_id,
      r.title,
      r.description,
      r.file_key,
      r.file_url || null,
      r.mime_type,
      r.size_bytes,
      r.department_id,
      r.level_id,
      r.group_id
    ]
  );
  return res.rows[0];
}

async function listResourcesForUser(user, { limit = 50 } = {}) {
  // Parse to int to guard against UUID/string bleed from the user object
  const dept = user.department_id != null ? parseInt(user.department_id, 10) : null;
  const lvl  = user.level_id     != null ? parseInt(user.level_id,     10) : null;
  const grp  = user.group_id     != null ? parseInt(user.group_id,     10) : null;
  const lim  = Math.min(Number(limit) || 50, 100);

  const res = await query(
    `
    SELECT *
    FROM resources
    WHERE
      ($1::int IS NULL OR department_id IS NULL OR department_id = $1::int)
      AND ($2::int IS NULL OR level_id IS NULL OR level_id = $2::int)
      AND ($3::int IS NULL OR group_id IS NULL OR group_id = $3::int)
    ORDER BY created_at DESC
    LIMIT $4;
  `,
    [dept, lvl, grp, lim]
  );
  return res.rows;
}

async function getResourceById(id) {
  const res = await query(`SELECT * FROM resources WHERE id = $1;`, [id]);
  return res.rows[0] || null;
}

async function getResourcesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const res = await query(`SELECT * FROM resources WHERE id = ANY($1::uuid[]);`, [ids]);
  return res.rows;
}

module.exports = { createResource, listResourcesForUser, getResourceById, getResourcesByIds };

