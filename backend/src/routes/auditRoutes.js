const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { auditController } = require("../controllers/announcementController");

const auditRouter = express.Router();

// SRS: Admin Global Audit - view ALL announcements across all channels
auditRouter.get(
  "/",
  authMiddleware,
  requireRole(["ADMIN"]),
  auditController
);

module.exports = { auditRouter };
