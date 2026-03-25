const { postAnnouncement, getFeed, getAuditFeed } = require("../services/announcementService");

async function postAnnouncementController(req, res, next) {
  try {
    const created = await postAnnouncement(req.user, req.body || {});
    return res.status(201).json({ announcement: created });
  } catch (e) {
    return next(e);
  }
}

async function feedController(req, res, next) {
  try {
    const { limit, before } = req.query || {};
    const feed = await getFeed(req.user, { limit, before });
    return res.json({ announcements: feed });
  } catch (e) {
    return next(e);
  }
}

async function auditController(req, res, next) {
  try {
    const { limit, before } = req.query || {};
    const feed = await getAuditFeed({ limit, before });
    return res.json({ announcements: feed });
  } catch (e) {
    return next(e);
  }
}

module.exports = { postAnnouncementController, feedController, auditController };

