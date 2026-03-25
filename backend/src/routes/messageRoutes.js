const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { sendMessageController, listMessagesController } = require("../controllers/messageController");

const messageRouter = express.Router();

messageRouter.get("/", authMiddleware, listMessagesController);
messageRouter.post("/", authMiddleware, requireRole(["LECTURER", "COURSE_REP", "STUDENT_EXEC"]), sendMessageController);

module.exports = { messageRouter };

