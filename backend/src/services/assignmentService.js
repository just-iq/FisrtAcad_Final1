const {
  createAssignment,
  listAssignmentsForUser,
  getAssignmentById,
  setPermitResubmission,
  createSubmission,
  countSubmissions,
  markPreviousNotLatest,
  listSubmissionsForAssignment
} = require("../models/assignmentModel");

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
  if (!(user.roles || []).includes("LECTURER")) throw forbid("Only lecturers can create assignments");
  const { title, description = null, department_id = null, level_id = null, group_id = null, due_at = null, permit_resubmission = false } = payload || {};
  if (!title) throw badRequest("title is required");

  if (user.department_id && department_id && !sameId(department_id, user.department_id)) throw forbid("Invalid department target");
  if (user.level_id && level_id && !sameId(level_id, user.level_id)) throw forbid("Invalid level target");
  if (user.group_id && group_id && !sameId(group_id, user.group_id)) throw forbid("Invalid group target");

  return await createAssignment({
    lecturer_id: user.id,
    title,
    description,
    department_id,
    level_id,
    group_id,
    due_at,
    permit_resubmission
  });
}

async function list(user, queryParams) {
  return await listAssignmentsForUser(user, queryParams);
}

async function toggleResubmission(user, assignmentId, permit_resubmission) {
  if (!(user.roles || []).includes("LECTURER")) throw forbid("Only lecturers can update resubmission policy");
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw badRequest("Assignment not found", "NOT_FOUND");
  if (assignment.lecturer_id !== user.id) throw forbid("Forbidden");
  return await setPermitResubmission(assignmentId, permit_resubmission);
}

async function submit(user, assignmentId, payload) {
  // SRS FIX: Architecture corrected - Reps/Execs now always have STUDENT role.
  // We can strictly check for STUDENT role now.
  if (!(user.roles || []).includes("STUDENT")) throw forbid("Only students can submit assignments");

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw badRequest("Assignment not found", "NOT_FOUND");

  // Scope enforcement: student must belong to assignment scope.
  if (assignment.department_id && !sameId(user.department_id, assignment.department_id)) throw forbid("Forbidden");
  if (assignment.level_id && !sameId(user.level_id, assignment.level_id)) throw forbid("Forbidden");
  if (assignment.group_id && !sameId(user.group_id, assignment.group_id)) throw forbid("Forbidden");

  const { file_key, mime_type = null, size_bytes = null } = payload || {};
  if (!file_key) throw badRequest("file_key is required");

  const existingCount = await countSubmissions(assignmentId, user.id);
  if (!assignment.permit_resubmission && existingCount > 0) throw forbid("Resubmission not permitted");

  if (assignment.permit_resubmission && existingCount > 0) {
    await markPreviousNotLatest(assignmentId, user.id);
  }

  return await createSubmission({
    assignment_id: assignmentId,
    student_id: user.id,
    file_key,
    mime_type,
    size_bytes,
    is_latest: true
  });
}

async function listSubmissions(user, assignmentId) {
  if (!(user.roles || []).includes("LECTURER")) throw forbid("Only lecturers can view submissions");
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw badRequest("Assignment not found", "NOT_FOUND");
  if (assignment.lecturer_id !== user.id) throw forbid("Forbidden");
  return await listSubmissionsForAssignment(assignmentId);
}

module.exports = { create, list, toggleResubmission, submit, listSubmissions };

