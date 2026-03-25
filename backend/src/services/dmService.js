const {
  createDM,
  getConversation,
  listConversations,
  markAsRead,
  markConversationAsRead,
  getUnreadCount,
  getUserForDM,
  listPotentialRecipients
} = require("../models/dmModel");
const { getIo } = require("../sockets");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.code = "FORBIDDEN";
  return err;
}

/**
 * Check if user can initiate a conversation (only staff can start, students can reply)
 */
function canInitiateConversation(user, hasExistingConversation) {
  const roles = user.roles || [];
  const isStaff = roles.some(r => ["LECTURER", "COURSE_REP", "STUDENT_EXEC", "ADMIN"].includes(r));
  
  if (isStaff) return true;
  
  // Students can only reply if there's an existing conversation
  return hasExistingConversation;
}

/**
 * Send a direct message
 */
async function send(sender, { receiver_id, body }) {
  if (!receiver_id) throw badRequest("receiver_id is required");
  if (!body || !body.trim()) throw badRequest("body is required");
  
  // Check if receiver exists
  const receiver = await getUserForDM(receiver_id);
  if (!receiver) throw badRequest("Recipient not found", "NOT_FOUND");
  
  // Check if conversation exists (for student permission check)
  const existingMessages = await getConversation(sender.id, receiver_id, { limit: 1 });
  const hasExistingConversation = existingMessages.length > 0;
  
  if (!canInitiateConversation(sender, hasExistingConversation)) {
    throw forbidden("Students can only reply to existing conversations");
  }
  
  // Scope check: staff should only message students in their department/level
  const senderRoles = sender.roles || [];
  const isStaff = senderRoles.some(r => ["LECTURER", "COURSE_REP", "STUDENT_EXEC", "ADMIN"].includes(r));
  const isAdmin = senderRoles.includes("ADMIN");
  
  if (isStaff && !isAdmin && !hasExistingConversation) {
    // Verify scope match for new conversations
    if (sender.department_id && receiver.department_id && sender.department_id !== receiver.department_id) {
      throw forbidden("Cannot message students outside your department");
    }
    if (sender.level_id && receiver.level_id && sender.level_id !== receiver.level_id) {
      throw forbidden("Cannot message students outside your level");
    }
  }
  
  const message = await createDM({
    sender_id: sender.id,
    receiver_id,
    body: body.trim()
  });
  
  // Emit socket event for real-time delivery
  try {
    const io = getIo();
    io.to(`user_${receiver_id}`).emit("dm:new", {
      ...message,
      sender_name: sender.full_name,
      sender_email: sender.email
    });
  } catch (e) {
    // Socket not critical, continue
  }
  
  return message;
}

/**
 * List all conversations for current user
 */
async function conversations(user) {
  return await listConversations(user.id);
}

/**
 * Get conversation with a specific user
 */
async function conversation(user, otherUserId, queryParams = {}) {
  const { limit, before } = queryParams;
  
  // Mark all messages as read when viewing conversation
  await markConversationAsRead(user.id, otherUserId);
  
  const messages = await getConversation(user.id, otherUserId, { limit, before });
  
  // Get other user info
  const otherUser = await getUserForDM(otherUserId);
  
  return {
    messages,
    otherUser
  };
}

/**
 * Mark a single message as read
 */
async function read(user, messageId) {
  const result = await markAsRead(messageId, user.id);
  if (!result) throw badRequest("Message not found or already read", "NOT_FOUND");
  return result;
}

/**
 * Get unread DM count
 */
async function unreadCount(user) {
  const count = await getUnreadCount(user.id);
  return { count };
}

/**
 * List potential recipients for new conversation
 */
async function recipients(user, queryParams = {}) {
  return await listPotentialRecipients(user, queryParams);
}

module.exports = {
  send,
  conversations,
  conversation,
  read,
  unreadCount,
  recipients
};
