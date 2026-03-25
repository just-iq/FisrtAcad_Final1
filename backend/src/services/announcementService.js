const { createAnnouncement, updateAnnouncementAI, getAnnouncementFeedForUser, getAllAnnouncementsForAudit } = require("../models/announcementModel");
const { analyzeAnnouncement } = require("./aiClient");
const { getIo } = require("../sockets");
const { roomsForScope } = require("../utils/rooms");
const { createAnnouncementNotifications } = require("./notificationService");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function inferRoleContext(user) {
  // Prefer privileged roles; ordering matters.
  const roles = user.roles || [];
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("LECTURER")) return "LECTURER";
  if (roles.includes("STUDENT_EXEC")) return "STUDENT_EXEC";
  if (roles.includes("COURSE_REP")) return "COURSE_REP";
  return "STUDENT";
}

// Normalize IDs to strings for comparison — DB may return integers, frontend sends strings
function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function validateAnnouncementTarget(user, { channel_type, department_id, level_id, group_id }) {
  const roles = user.roles || [];

  if (!channel_type) throw badRequest("channel_type is required");
  if (!["SCHOOL", "DEPARTMENT_LEVEL", "GROUP"].includes(channel_type)) throw badRequest("Invalid channel_type");

  if (roles.length === 1 && roles[0] === "STUDENT") throw badRequest("Students cannot post announcements", "FORBIDDEN");

  if (roles.includes("STUDENT_EXEC")) {
    if (!["SCHOOL", "DEPARTMENT_LEVEL"].includes(channel_type)) throw badRequest("Invalid channel type for student executive");
    if (channel_type === "DEPARTMENT_LEVEL") {
      if (!department_id) throw badRequest("department_id is required");
      if (user.department_id && !sameId(department_id, user.department_id)) throw badRequest("Cannot target outside your department");
    }
    if (group_id) throw badRequest("group_id not allowed");
    return;
  }

  if (roles.includes("COURSE_REP")) {
    if (channel_type === "SCHOOL") throw badRequest("Course reps cannot post school-level announcements");
    if (user.department_id && department_id && !sameId(department_id, user.department_id)) throw badRequest("Invalid department target");
    if (user.level_id && level_id && !sameId(level_id, user.level_id)) throw badRequest("Invalid level target");
    if (channel_type === "GROUP" && user.group_id && !sameId(group_id, user.group_id)) throw badRequest("Invalid group target");
    return;
  }

  if (roles.includes("LECTURER")) {
    if (channel_type !== "SCHOOL") {
      if (user.department_id && department_id && !sameId(department_id, user.department_id)) throw badRequest("Invalid department target");
      if (user.level_id && level_id && !sameId(level_id, user.level_id)) throw badRequest("Invalid level target");
      if (channel_type === "GROUP" && user.group_id && group_id && !sameId(group_id, user.group_id)) throw badRequest("Invalid group target");
    }
    return;
  }

  // Admin: unrestricted
}

async function postAnnouncement(author, payload) {
  const { title, body, channel_type, department_id = null, level_id = null, group_id = null } = payload || {};
  if (!title || !body) throw badRequest("title and body are required");

  validateAnnouncementTarget(author, { channel_type, department_id, level_id, group_id });

  const role_context = inferRoleContext(author);
  const announcement = await createAnnouncement({
    author_id: author.id,
    role_context,
    title,
    body,
    channel_type,
    department_id,
    level_id,
    group_id
  });

  // Broadcast immediately — don't block on AI or notifications.
  const rooms = roomsForScope(announcement);
  const io = getIo();
  rooms.forEach((r) => io.to(r).emit("announcement:new", announcement));

  // Persist notifications for all users in scope (fire-and-forget so they show in bell when offline).
  createAnnouncementNotifications(announcement).catch(() => {});

  // AI enrichment runs in the background; when done it patches the DB and pushes an update.
  analyzeAnnouncement({ id: announcement.id, title: announcement.title, body: announcement.body })
    .then(async (ai) => {
      if (!ai?.priority && !ai?.summary) return;
      const enriched = await updateAnnouncementAI(announcement.id, {
        priority: ai.priority,
        summary: ai.summary,
        ai_score: ai.score
      });
      if (enriched) {
        rooms.forEach((r) => io.to(r).emit("announcement:updated", enriched));
      }
    })
    .catch(() => {}); // best-effort; never crash the request

  return announcement;
}

async function getFeed(user, query) {
  return await getAnnouncementFeedForUser(user, query);
}

async function getAuditFeed(query) {
  return await getAllAnnouncementsForAudit(query);
}

module.exports = { postAnnouncement, getFeed, getAuditFeed };

