const { verifyPassword, hashPassword } = require("../utils/password");
const { signAccessToken } = require("../utils/jwt");
const { findUserByEmailWithRoles, createUser, setUserRoles, setUserRoleAssignments } = require("../models/userModel");
const { getRoleIdsByNames, getRoleIdByName } = require("../models/roleModel");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function unauthorized(message, code = "UNAUTHORIZED") {
  const err = new Error(message);
  err.statusCode = 401;
  err.code = code;
  return err;
}

async function login({ email, password }) {
  if (!email || !password) throw badRequest("email and password are required");

  const user = await findUserByEmailWithRoles(email);
  if (!user) throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  if (!user.is_active) throw unauthorized("User disabled", "USER_DISABLED");

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");

  const tokenPayload = {
    sub: user.id,
    roles: user.roles,
    department_id: user.department_id,
    level_id: user.level_id,
    group_id: user.group_id
  };

  return {
    access_token: signAccessToken(tokenPayload),

    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      roles: user.roles,

      department: user.department,
      level: user.level,
      group: user.group
    }
  };
}

// Admin-only route guards are enforced at routing layer; this validates payload and persists.
async function registerUser(payload) {
  const { email, password, full_name, department_id, level_id, group_id, roles, role_assignments } = payload || {};
  if (!email || !password || !full_name) throw badRequest("email, password, full_name are required");
  const hasRoleNames = Array.isArray(roles) && roles.length > 0;
  const hasAssignments = Array.isArray(role_assignments) && role_assignments.length > 0;
  if (!hasRoleNames && !hasAssignments) throw badRequest("roles or role_assignments must be provided");

  const password_hash = await hashPassword(password);
  const user = await createUser({
    email,
    password_hash,
    full_name,
    department_id: department_id || null,
    level_id: level_id || null,
    group_id: group_id || null,
    is_active: true
  });

  if (hasAssignments) {
    const assignments = [];
    
    // SRS REF: Student role is base for Rep/Exec
    const roleNamesToAdd = role_assignments.map(r => r?.name);
    const isStudentExt = roleNamesToAdd.includes("COURSE_REP") || roleNamesToAdd.includes("STUDENT_EXEC");
    const hasStudent = roleNamesToAdd.includes("STUDENT");
    
    if (isStudentExt && !hasStudent) {
      role_assignments.push({ name: "STUDENT" });
    }

    for (const ra of role_assignments) {
      const role_id = await getRoleIdByName(ra.name);
      assignments.push({
        role_id,
        scope_department_id: ra.scope_department_id,
        scope_level_id: ra.scope_level_id,
        scope_group_id: ra.scope_group_id
      });
    }
    await setUserRoleAssignments(user.id, assignments);
  } else {
    // SRS REF: Student role is base for Rep/Exec
    const isStudentExt = roles.includes("COURSE_REP") || roles.includes("STUDENT_EXEC");
    const hasStudent = roles.includes("STUDENT");
    
    if (isStudentExt && !hasStudent) {
      roles.push("STUDENT");
    }

    const roleIds = await getRoleIdsByNames(roles);
    await setUserRoles(user.id, roleIds);
  }

  return { id: user.id };
}

module.exports = { login, registerUser };

