const { query } = require("../db");

async function markAnnouncementReadController(req, res, next) {
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
}

module.exports = { markAnnouncementReadController };

