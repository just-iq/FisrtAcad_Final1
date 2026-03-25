const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const notificationService = require("../services/notificationService");

const router = express.Router();

// Get current user's notifications
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const notifications = await notificationService.list(req.user, req.query);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

// Get unread count
router.get("/unread-count", authMiddleware, async (req, res, next) => {
  try {
    const result = await notificationService.unreadCount(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mark a single notification as read
router.post("/:id/read", authMiddleware, async (req, res, next) => {
  try {
    const notification = await notificationService.read(req.user, req.params.id);
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
router.post("/read-all", authMiddleware, async (req, res, next) => {
  try {
    const result = await notificationService.readAll(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Generate reminders (admin/system endpoint)
router.post("/generate", authMiddleware, async (req, res, next) => {
  try {
    // Optional: restrict to admin
    // if (!(req.user.roles || []).includes("ADMIN")) {
    //   return res.status(403).json({ error: "Forbidden" });
    // }
    const result = await notificationService.generateAllReminders(true);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
