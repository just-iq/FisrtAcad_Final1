const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const {
  getTimetableController,
  createTimetableController,
  updateTimetableController,
  deleteTimetableController,
  triggerTimetableController
} = require("../controllers/timetableController");

const timetableRouter = express.Router();

timetableRouter.get("/", authMiddleware, getTimetableController);
timetableRouter.post("/", authMiddleware, requireRole(["COURSE_REP"]), createTimetableController);
// SRS FIX: Using PATCH instead of PUT for partial updates (consistent with frontend API client)
timetableRouter.patch("/:id", authMiddleware, requireRole(["COURSE_REP"]), updateTimetableController);
timetableRouter.delete("/:id", authMiddleware, requireRole(["COURSE_REP"]), deleteTimetableController);
timetableRouter.post("/:id/trigger", authMiddleware, requireRole(["ADMIN", "COURSE_REP"]), triggerTimetableController);

module.exports = { timetableRouter };

