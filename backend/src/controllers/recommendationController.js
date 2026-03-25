const { recommendResources } = require("../services/recommendationService");

async function recommendResourcesController(req, res, next) {
  try {
    // Only allow a student to fetch their own recommendations, or admin.
    const requested = req.params.student_id;
    const roles = req.user.roles || [];
    if (requested !== req.user.id && !roles.includes("ADMIN")) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Forbidden" } });
    }

    const recs = await recommendResources(requested, req.user);
    return res.json(recs);
  } catch (e) {
    return next(e);
  }
}

module.exports = { recommendResourcesController };

