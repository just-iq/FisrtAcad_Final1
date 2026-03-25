const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const dmService = require("../services/dmService");

const router = express.Router();

// Send a direct message
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const message = await dmService.send(req.user, req.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

// List all conversations
router.get("/conversations", authMiddleware, async (req, res, next) => {
  try {
    const conversations = await dmService.conversations(req.user);
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

// Get conversation with specific user
router.get("/conversations/:userId", authMiddleware, async (req, res, next) => {
  try {
    const result = await dmService.conversation(req.user, req.params.userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mark message as read
router.post("/:id/read", authMiddleware, async (req, res, next) => {
  try {
    const message = await dmService.read(req.user, req.params.id);
    res.json({ message });
  } catch (err) {
    next(err);
  }
});

// Get unread count
router.get("/unread-count", authMiddleware, async (req, res, next) => {
  try {
    const result = await dmService.unreadCount(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// List potential recipients
router.get("/recipients", authMiddleware, async (req, res, next) => {
  try {
    const recipients = await dmService.recipients(req.user, req.query);
    res.json({ recipients });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
