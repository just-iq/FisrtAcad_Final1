const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { upload } = require("../middleware/upload");
const {
  createAssignmentController,
  listAssignmentsController,
  toggleResubmissionController,
  submitAssignmentController,
  listSubmissionsController
} = require("../controllers/assignmentController");

const assignmentRouter = express.Router();

assignmentRouter.get("/", authMiddleware, listAssignmentsController);
assignmentRouter.post("/", authMiddleware, requireRole(["LECTURER"]), createAssignmentController);
assignmentRouter.patch("/:id/resubmission", authMiddleware, requireRole(["LECTURER"]), toggleResubmissionController);

// SRS FIX: Architecture corrected - Reps/Execs also have STUDENT role now.
assignmentRouter.post("/:id/submissions", authMiddleware, requireRole(["STUDENT"]), upload.single("file"), submitAssignmentController);

// Lecturer submissions listing
assignmentRouter.get("/:id/submissions", authMiddleware, requireRole(["LECTURER"]), listSubmissionsController);

module.exports = { assignmentRouter };

