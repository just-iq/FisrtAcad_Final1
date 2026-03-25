const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { config } = require("../config/config");

let ioInstance = null;

// SRS FIX: Socket auth must hydrate user from database to get current department_id/level_id/group_id
// The JWT payload may be stale or not contain metadata needed for room assignments.
async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
      socket.handshake.query?.token;

    if (!token) {
      const err = new Error("Missing socket auth token");
      err.data = { code: "SOCKET_AUTH_REQUIRED" };
      return next(err);
    }

    const payload = jwt.verify(token, config.jwt.secret);
    
    // Hydrate from DB to get fresh dept/level/group data for correct room assignments
    const { findUserByIdWithRoles } = require("../models/userModel");
    const user = await findUserByIdWithRoles(payload.sub);
    if (!user || !user.is_active) {
      const err = new Error("User not found or inactive");
      err.data = { code: "SOCKET_AUTH_INVALID" };
      return next(err);
    }
    
    socket.user = user;
    return next();
  } catch (e) {
    const err = new Error("Invalid socket auth token");
    err.data = { code: "SOCKET_AUTH_INVALID" };
    return next(err);
  }
}

function getRoomNamesForUser(user) {
  const rooms = ["school_global"];
  if (user.department_id && user.level_id) rooms.push(`dept_${user.department_id}_level_${user.level_id}`);
  if (user.group_id) rooms.push(`group_${user.group_id}`);
  return rooms;
}

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
    transports: ["websocket", "polling"]
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const rooms = getRoomNamesForUser(socket.user || {});
    // Also join a personal room for per-user notifications
    if (socket.user?.id) rooms.push(`user_${socket.user.id}`);
    rooms.forEach((r) => socket.join(r));

    socket.emit("socket:ready", { rooms });
  });

  ioInstance = io;
  return io;
}

function getIo() {
  if (!ioInstance) throw new Error("Socket.io server not initialized");
  return ioInstance;
}

module.exports = { createSocketServer, getIo, getRoomNamesForUser };

