const {
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTimetableForUser,
  findTimetableEntryById
} = require("../models/timetableModel");
const { getIo } = require("../sockets");
const { roomsForScope } = require("../utils/rooms");

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

function ensureCourseRep(user) {
  if (!(user.roles || []).includes("COURSE_REP")) throw forbid("Only Course Reps can manage timetable");
}

// Normalize IDs to strings — DB may return integers, frontend sends strings
function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function ensureScopeMatches(user, { department_id, level_id, group_id }) {
  if (user.department_id && !sameId(department_id, user.department_id)) throw forbid("Invalid department scope");
  if (user.level_id && !sameId(level_id, user.level_id)) throw forbid("Invalid level scope");
  if (user.group_id && group_id && !sameId(group_id, user.group_id)) throw forbid("Invalid group scope");
}

async function createEntry(user, payload) {
  ensureCourseRep(user);
  const {
    department_id,
    level_id,
    group_id = null,
    course_code,
    course_title,
    location = null,
    day_of_week,
    start_time,
    end_time,
    notes = null
  } = payload || {};

  if (!department_id || !level_id) throw badRequest("department_id and level_id are required");
  if (!course_code || !course_title) throw badRequest("course_code and course_title are required");
  if (day_of_week === undefined || day_of_week === null) throw badRequest("day_of_week is required");
  if (!start_time || !end_time) throw badRequest("start_time and end_time are required");

  ensureScopeMatches(user, { department_id, level_id, group_id });

  const created = await createTimetableEntry({
    course_rep_id: user.id,
    department_id,
    level_id,
    group_id,
    course_code,
    course_title,
    location,
    day_of_week,
    start_time,
    end_time,
    notes
  });

  const io = getIo();
  const rooms = roomsForScope({ channel_type: group_id ? "GROUP" : "DEPARTMENT_LEVEL", department_id, level_id, group_id });
  rooms.forEach((r) => io.to(r).emit("timetable:updated", { type: "created", entry: created }));

  return created;
}

async function updateEntry(user, id, patch) {
  ensureCourseRep(user);
  const existing = await findTimetableEntryById(id);
  if (!existing) throw badRequest("Timetable entry not found", "NOT_FOUND");
  ensureScopeMatches(user, {
    department_id: existing.department_id,
    level_id: existing.level_id,
    group_id: existing.group_id
  });

  const updated = await updateTimetableEntry(id, patch || {});
  const io = getIo();
  const rooms = roomsForScope({
    channel_type: existing.group_id ? "GROUP" : "DEPARTMENT_LEVEL",
    department_id: existing.department_id,
    level_id: existing.level_id,
    group_id: existing.group_id
  });
  rooms.forEach((r) => io.to(r).emit("timetable:updated", { type: "updated", entry: updated }));
  return updated;
}

async function removeEntry(user, id) {
  ensureCourseRep(user);
  const existing = await findTimetableEntryById(id);
  if (!existing) return;
  ensureScopeMatches(user, {
    department_id: existing.department_id,
    level_id: existing.level_id,
    group_id: existing.group_id
  });
  await deleteTimetableEntry(id);
  const io = getIo();
  const rooms = roomsForScope({
    channel_type: existing.group_id ? "GROUP" : "DEPARTMENT_LEVEL",
    department_id: existing.department_id,
    level_id: existing.level_id,
    group_id: existing.group_id
  });
  rooms.forEach((r) => io.to(r).emit("timetable:updated", { type: "deleted", entry_id: id }));
}

async function fetchTimetable(user) {
  if (!user.department_id && !user.level_id && !user.group_id) return [];
  return await getTimetableForUser(user);
}

async function triggerNotification(user, entryId, type = "UPCOMING_CLASS") {
  // Minimal: just emit. Frontend handles push.
  const entry = await findTimetableEntryById(entryId);
  if (!entry) throw badRequest("Timetable entry not found", "NOT_FOUND");
  // Allow admins or course reps within scope.
  const roles = user.roles || [];
  if (!roles.includes("ADMIN") && !roles.includes("COURSE_REP")) throw forbid("Forbidden");
  if (roles.includes("COURSE_REP")) ensureScopeMatches(user, entry);

  const io = getIo();
  const rooms = roomsForScope({
    channel_type: entry.group_id ? "GROUP" : "DEPARTMENT_LEVEL",
    department_id: entry.department_id,
    level_id: entry.level_id,
    group_id: entry.group_id
  });
  rooms.forEach((r) => io.to(r).emit("notification:event", { type, timetable_entry_id: entryId }));
  return { ok: true };
}

module.exports = { createEntry, updateEntry, removeEntry, fetchTimetable, triggerNotification };

