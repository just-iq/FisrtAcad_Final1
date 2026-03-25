const { query } = require("../db");
const { getRoleIdByName } = require("../models/roleModel");
const { setUserRoleAssignments, updateUserMetadata, findUserByIdWithRoles } = require("../models/userModel");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

async function listUsers(filters) {
  const { email } = filters || {};
  const params = [];
  const where = [];

  if (email) {
    params.push(email.toLowerCase());
    where.push(`LOWER(u.email) = $${params.length}`);
  }

  const res = await query(
    `
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.department_id,
      u.level_id,
      u.group_id,
      u.is_active,

      d.name AS department_name,
      l.name AS level_name,
      g.name AS group_name,

      COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles

    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN levels l ON u.level_id = l.id
    LEFT JOIN groups g ON u.group_id = g.id

    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id

    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}

    GROUP BY u.id, d.name, l.name, g.name
    ORDER BY u.created_at DESC
    LIMIT 200;
  `,
    params
  );

  // 🔧 Convert SQL fields to objects your frontend expects
  return res.rows.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    roles: u.roles,
    is_active: u.is_active,

    department: u.department_name
      ? { id: u.department_id, name: u.department_name }
      : null,

    level: u.level_name
      ? { id: u.level_id, name: u.level_name }
      : null,

    group: u.group_name
      ? { id: u.group_id, name: u.group_name }
      : null,
  }));
}

async function updateUser(userId, payload) {
  const { full_name, department_id, level_id, group_id, is_active, role_assignments } = payload || {};

  const updated = await updateUserMetadata(userId, { full_name, department_id, level_id, group_id, is_active });
  if (!updated) throw badRequest("User not found", "USER_NOT_FOUND");

  if (Array.isArray(role_assignments)) {
    const assignments = [];
    const roleNamesToAdd = role_assignments.map(r => r?.name);
    
    // SRS REF: Course Rep and Student Exec are base STUDENTs.
    // Ensure STUDENT role is included if they are being assigned Rep/Exec roles.
    const isStudentExt = roleNamesToAdd.includes("COURSE_REP") || roleNamesToAdd.includes("STUDENT_EXEC");
    const hasStudent = roleNamesToAdd.includes("STUDENT");
    
    if (isStudentExt && !hasStudent) {
      role_assignments.push({ name: "STUDENT" });
    }

    for (const ra of role_assignments) {
      if (!ra?.name) throw badRequest("role_assignments[].name is required");
      const role_id = await getRoleIdByName(ra.name);
      assignments.push({
        role_id,
        role_name: ra.name, // Pass name for deduping if needed, though Set ensures unique ID
        scope_department_id: ra.scope_department_id,
        scope_level_id: ra.scope_level_id,
        scope_group_id: ra.scope_group_id
      });
    }
    await setUserRoleAssignments(userId, assignments);
  }

  return await findUserByIdWithRoles(userId);
}

module.exports = { listUsers, updateUser };

