const { createMessage, listMessagesForUser } = require("../models/messageModel");
const { getIo } = require("../sockets");
const { roomsForScope } = require("../utils/rooms");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function inferSenderRole(user) {
  const roles = user.roles || [];
  if (roles.includes("LECTURER")) return "LECTURER";
  if (roles.includes("COURSE_REP")) return "COURSE_REP";
  if (roles.includes("STUDENT_EXEC")) return "STUDENT_EXEC";
  return null;
}

// Normalize IDs to strings — DB may return integers, frontend sends strings
function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function validateMessageTarget(user, { channel_type, department_id, level_id, group_id }) {
  const sender_role = inferSenderRole(user);
  if (!sender_role) throw badRequest("Only Lecturers, Course Reps, and Student Executives can send messages", "FORBIDDEN");

  if (!channel_type) throw badRequest("channel_type is required");
  if (!["DEPARTMENT_LEVEL", "GROUP"].includes(channel_type)) throw badRequest("Invalid channel_type");

  if (sender_role === "STUDENT_EXEC") {
    if (channel_type !== "DEPARTMENT_LEVEL") throw badRequest("Student Executives can only send department+level messages");
    if (!department_id || !level_id) throw badRequest("department_id and level_id required");
    if (user.department_id && !sameId(department_id, user.department_id)) throw badRequest("Cannot target outside your department");
    if (group_id) throw badRequest("group_id not allowed");
    return sender_role;
  }

  if (sender_role === "COURSE_REP") {
    if (channel_type === "DEPARTMENT_LEVEL") {
      if (!department_id || !level_id) throw badRequest("department_id and level_id required");
      if (user.department_id && !sameId(department_id, user.department_id)) throw badRequest("Invalid department target");
      if (user.level_id && !sameId(level_id, user.level_id)) throw badRequest("Invalid level target");
      if (group_id) throw badRequest("group_id not allowed");
      return sender_role;
    }
    // GROUP
    if (!group_id) throw badRequest("group_id required");
    if (user.group_id && !sameId(group_id, user.group_id)) throw badRequest("Invalid group target");
    return sender_role;
  }

  // Lecturer
  if (sender_role === "LECTURER") {
    if (channel_type === "DEPARTMENT_LEVEL") {
      if (!department_id || !level_id) throw badRequest("department_id and level_id required");
      if (user.department_id && !sameId(department_id, user.department_id)) throw badRequest("Invalid department target");
      if (user.level_id && !sameId(level_id, user.level_id)) throw badRequest("Invalid level target");
      if (group_id) throw badRequest("group_id not allowed");
      return sender_role;
    }
    if (!group_id) throw badRequest("group_id required");
    if (user.group_id && !sameId(group_id, user.group_id)) throw badRequest("Invalid group target");
    return sender_role;
  }

  return sender_role;
}

async function sendMessage(sender, payload) {
  const { body, channel_type, department_id = null, level_id = null, group_id = null } = payload || {};
  if (!body) throw badRequest("body is required");

  const sender_role = validateMessageTarget(sender, { channel_type, department_id, level_id, group_id });

  const message = await createMessage({
    sender_id: sender.id,
    sender_role,
    channel_type,
    department_id,
    level_id,
    group_id,
    body
  });

  const rooms = roomsForScope({ channel_type, department_id, level_id, group_id });
  const io = getIo();
  rooms.forEach((r) => io.to(r).emit("message:new", message));

  return message;
}

async function listMessages(user, query) {
  return await listMessagesForUser(user, query);
}

module.exports = { sendMessage, listMessages };

