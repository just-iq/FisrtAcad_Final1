const { createResource, listResourcesForUser, getResourceById } = require("../models/resourceModel");
const { query } = require("../db");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function forbid(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.code = "FORBIDDEN";
  return err;
}

// Normalize IDs to strings — DB may return integers, frontend sends strings
function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

async function create(user, payload) {
  if (!(user.roles || []).includes("LECTURER")) throw forbid("Only lecturers can upload resources");
  const { title, description = null, file_key, file_url = null, mime_type = null, size_bytes = null, department_id = null, level_id = null, group_id = null } =
    payload || {};
  if (!title || !file_key) throw badRequest("title and file_key are required");

  if (user.department_id && department_id && !sameId(department_id, user.department_id)) throw forbid("Invalid department target");
  if (user.level_id && level_id && !sameId(level_id, user.level_id)) throw forbid("Invalid level target");
  if (user.group_id && group_id && !sameId(group_id, user.group_id)) throw forbid("Invalid group target");

  return await createResource({
    lecturer_id: user.id,
    title,
    description,
    file_key,
    file_url,
    mime_type,
    size_bytes,
    department_id,
    level_id,
    group_id
  });
}

async function list(user, queryParams) {
  return await listResourcesForUser(user, queryParams);
}

async function get(user, id) {
  const r = await getResourceById(id);
  if (!r) throw badRequest("Resource not found", "NOT_FOUND");
  // Visibility enforced by scope filters; for direct get, re-check.
  if (r.department_id && !sameId(user.department_id, r.department_id)) throw forbid("Forbidden");
  if (r.level_id && !sameId(user.level_id, r.level_id)) throw forbid("Forbidden");
  if (r.group_id && !sameId(user.group_id, r.group_id)) throw forbid("Forbidden");
  return r;
}

async function recordInteraction(user, resource_id, interaction_type) {
  if (!["VIEW", "DOWNLOAD"].includes(interaction_type)) throw badRequest("Invalid interaction_type");
  await query(
    `INSERT INTO user_resource_interactions (user_id, resource_id, interaction_type, weight) VALUES ($1,$2,$3,$4);`,
    [user.id, resource_id, interaction_type, interaction_type === "DOWNLOAD" ? 2.0 : 1.0]
  );
  return { ok: true };
}

module.exports = { create, list, get, recordInteraction };

