const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { postAnnouncementController, feedController, auditController } = require("../controllers/announcementController");

const announcementRouter = express.Router();

announcementRouter.get("/feed", authMiddleware, feedController);

// SRS: Admin Global Audit moved to auditRoutes.js due to route registration issues

announcementRouter.post(
  "/",
  authMiddleware,
  requireRole(["ADMIN", "LECTURER", "STUDENT_EXEC", "COURSE_REP"]),
  postAnnouncementController
);

module.exports = { announcementRouter };

