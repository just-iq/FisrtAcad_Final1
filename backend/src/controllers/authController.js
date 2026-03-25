const { login, registerUser } = require("../services/authService");

async function loginController(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await login({ email, password });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function registerController(req, res, next) {
  try {
    const result = await registerUser(req.body || {});
    return res.status(201).json(result);
  } catch (e) {
    return next(e);
  }
}

async function signupController(req, res, next) {
  try {
    const { role, department_id, level_id, group_id } = req.body || {};

    // Whitelist public signup roles
    const validRoles = ["STUDENT", "LECTURER"];
    const normalizedRole = role ? String(role).toUpperCase().trim() : "";
    const assignedRole = validRoles.includes(normalizedRole) ? normalizedRole : "STUDENT";

    // Build role_assignments with scope so user_roles.scope_* columns are populated
    const isStudent = assignedRole === "STUDENT";
    const role_assignments = [
      {
        name: assignedRole,
        scope_department_id: isStudent ? (department_id || null) : null,
        scope_level_id: isStudent ? (level_id || null) : null,
        scope_group_id: isStudent ? (group_id || null) : null,
      },
    ];

    const payload = { ...(req.body || {}), role_assignments, roles: [] };
    const result = await registerUser(payload);
    return res.status(201).json(result);
  } catch (e) {
    return next(e);
  }
}

module.exports = { loginController, registerController, signupController };

