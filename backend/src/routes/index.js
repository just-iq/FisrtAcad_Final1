const express = require("express");

const { authRouter } = require("./authRoutes");
const { userRouter } = require("./userRoutes");
const { announcementRouter } = require("./announcementRoutes");
const { messageRouter } = require("./messageRoutes");
const { timetableRouter } = require("./timetableRoutes");
const { assignmentRouter } = require("./assignmentRoutes");
const { resourceRouter } = require("./resourceRoutes");
const { interactionRouter } = require("./interactionRoutes");
const { recommendationRouter } = require("./recommendationRoutes");

function registerRoutes(app) {
  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/users", userRouter);
  api.use("/announcements", announcementRouter);
  api.use("/messages", messageRouter);
  api.use("/timetable", timetableRouter);
  api.use("/assignments", assignmentRouter);
  api.use("/resources", resourceRouter);
  api.use("/interactions", interactionRouter);
  api.use("/recommend", recommendationRouter);
  
  // SRS: Admin Audit Workaround
  const { auditRouter } = require("./auditRoutes");
  api.use("/audit", auditRouter);

  const { academicRouter } = require("./academicRoutes");
  api.use("/academic", academicRouter);

  // New Events Router
  const { eventRouter } = require("./eventRoutes");
  api.use("/events", eventRouter);

  // Personalized Notifications Router
  const notificationRouter = require("./notificationRoutes");
  api.use("/notifications", notificationRouter);

  // Direct Messages Router
  const dmRouter = require("./dmRoutes");
  api.use("/dm", dmRouter);

  // Web Push Router
  const pushRouter = require("./pushRoutes");
  api.use("/push", pushRouter);

  app.use("/api", api);
}

module.exports = { registerRoutes };

