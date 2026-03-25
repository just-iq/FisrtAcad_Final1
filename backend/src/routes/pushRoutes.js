const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { saveSubscription } = require("../services/pushService");

const router = express.Router();

// Save push subscription for authenticated user
router.post("/subscribe", authMiddleware, async (req, res, next) => {
  try {
    await saveSubscription(req.user.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Expose VAPID public key so the client can subscribe
router.get("/vapid-public-key", (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

module.exports = router;
