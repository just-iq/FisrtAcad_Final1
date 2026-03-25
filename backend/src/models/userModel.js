const { query } = require("../db");
const { randomUUID } = require("crypto");

async function findUserByEmailWithRoles(email) {
  const res = await query(
    `
    SELECT
      u.*,

      d.id AS department_id,
      d.name AS department_name,

      l.id AS level_id,
      l.name AS level_name,

      g.id AS group_id,
      g.name AS group_name,

      COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles

    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id

    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN levels l ON l.id = u.level_id
    LEFT JOIN groups g ON g.id = u.group_id

    WHERE u.email = $1
    GROUP BY u.id, d.id, l.id, g.id;
  `,
    [email]
  );

  const user = res.rows[0];
  if (!user) return null;

  return {
    ...user,
    department: user.department_name
      ? { id: user.department_id, name: user.department_name }
      : null,
    level: user.level_name
      ? { id: user.level_id, name: user.level_name }
      : null,
    group: user.group_name
      ? { id: user.group_id, name: user.group_name }
      : null
  };
}

async function findUserByIdWithRoles(id) {
  const res = await query(
    `
    SELECT
      u.*,

      d.id AS department_id,
      d.name AS department_name,

      l.id AS level_id,
      l.name AS level_name,

      g.id AS group_id,
      g.name AS group_name,

      COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles

    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id

    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN levels l ON l.id = u.level_id
    LEFT JOIN groups g ON g.id = u.group_id

    WHERE u.id = $1
    GROUP BY u.id, d.id, l.id, g.id;
  `,
    [id]
  );

  const user = res.rows[0];
  if (!user) return null;

  return {
    ...user,
    department: user.department_name
      ? { id: user.department_id, name: user.department_name }
      : null,
    level: user.level_name
      ? { id: user.level_id, name: user.level_name }
      : null,
    group: user.group_name
      ? { id: user.group_id, name: user.group_name }
      : null
  };
}

async function createUser({
  email,
  password_hash,
  full_name,
  department_id,
  level_id,
  group_id,
  is_active
}) {
  const id = randomUUID();

  const res = await query(
    `
    INSERT INTO users (id, email, password_hash, full_name, department_id, level_id, group_id, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id, email, full_name, department_id, level_id, group_id, is_active;
  `,
    [id, email, password_hash, full_name, department_id, level_id, group_id, is_active]
  );

  return res.rows[0];
}

async function setUserRoles(userId, roleIds) {
  await query(`DELETE FROM user_roles WHERE user_id = $1;`, [userId]);

  for (const roleId of roleIds) {
    await query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2);`,
      [userId, roleId]
    );
  }
}

async function setUserRoleAssignments(userId, assignments) {
  await query(`DELETE FROM user_roles WHERE user_id = $1;`, [userId]);

  for (const a of assignments) {
    await query(
      `
      INSERT INTO user_roles (user_id, role_id, scope_department_id, scope_level_id, scope_group_id)
      VALUES ($1,$2,$3,$4,$5);
    `,
      [
        userId,
        a.role_id,
        a.scope_department_id || null,
        a.scope_level_id || null,
        a.scope_group_id || null
      ]
    );
  }
}

async function updateUserMetadata(userId, { full_name, department_id, level_id, group_id, is_active }) {
  const res = await query(
    `
    UPDATE users
    SET
      full_name = COALESCE($2, full_name),
      department_id = COALESCE($3, department_id),
      level_id = COALESCE($4, level_id),
      group_id = COALESCE($5, group_id),
      is_active = COALESCE($6, is_active),
      updated_at = now()
    WHERE id = $1
    RETURNING id, email, full_name, department_id, level_id, group_id, is_active;
  `,
    [userId, full_name ?? null, department_id ?? null, level_id ?? null, group_id ?? null, is_active ?? null]
  );

  return res.rows[0] || null;
}

module.exports = {
  findUserByEmailWithRoles,
  findUserByIdWithRoles,
  createUser,
  setUserRoles,
  setUserRoleAssignments,
  updateUserMetadata
};