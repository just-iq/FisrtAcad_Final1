const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { query } = require("../db");

const interactionRouter = express.Router();

// Mark single announcement as read
interactionRouter.post("/announcements/:id/read", authMiddleware, async (req, res, next) => {
  try {
    await query(
      `INSERT INTO user_announcement_reads (user_id, announcement_id) VALUES ($1,$2)
       ON CONFLICT (user_id, announcement_id) DO UPDATE SET read_at = now();`,
      [req.user.id, req.params.id]
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// Mark all announcements in a channel as read
interactionRouter.post("/announcements/read-channel", authMiddleware, async (req, res, next) => {
  try {
    const { channel_type } = req.body;
    if (!["SCHOOL", "DEPARTMENT_LEVEL", "GROUP"].includes(channel_type)) {
      return res.status(400).json({ error: { message: "Invalid channel_type" } });
    }

    const user = req.user;
    let whereClause = "a.channel_type = $2";
    const params = [user.id, channel_type];

    // Scope to user's metadata for non-school channels
    if (channel_type === "DEPARTMENT_LEVEL" && user.department_id && user.level_id) {
      whereClause += " AND a.department_id = $3 AND a.level_id = $4";
      params.push(user.department_id, user.level_id);
    } else if (channel_type === "GROUP" && user.group_id) {
      whereClause += " AND a.group_id = $3";
      params.push(user.group_id);
    }

    const result = await query(
      `INSERT INTO user_announcement_reads (user_id, announcement_id)
       SELECT $1, a.id FROM announcements a
       WHERE ${whereClause}
         AND NOT EXISTS (
           SELECT 1 FROM user_announcement_reads r 
           WHERE r.user_id = $1 AND r.announcement_id = a.id
         )
       ON CONFLICT (user_id, announcement_id) DO NOTHING;`,
      params
    );

    return res.json({ marked: result.rowCount || 0 });
  } catch (e) {
    return next(e);
  }
});

// Get unread counts per channel
interactionRouter.get("/announcements/unread-counts", authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;

    // Build scope conditions for user's visible announcements
    const scopeConditions = ["a.channel_type = 'SCHOOL'"];
    const params = [user.id];

    if (user.department_id && user.level_id) {
      params.push(user.department_id, user.level_id);
      scopeConditions.push(`(a.channel_type = 'DEPARTMENT_LEVEL' AND a.department_id = $${params.length - 1} AND a.level_id = $${params.length})`);
    }

    if (user.group_id) {
      params.push(user.group_id);
      scopeConditions.push(`(a.channel_type = 'GROUP' AND a.group_id = $${params.length})`);
    }

    const result = await query(
      `SELECT a.channel_type, COUNT(*) as count
       FROM announcements a
       WHERE (${scopeConditions.join(" OR ")})
         AND NOT EXISTS (
           SELECT 1 FROM user_announcement_reads r 
           WHERE r.user_id = $1 AND r.announcement_id = a.id
         )
       GROUP BY a.channel_type;`,
      params
    );

    return res.json({ counts: result.rows });
  } catch (e) {
    return next(e);
  }
});

module.exports = { interactionRouter };
