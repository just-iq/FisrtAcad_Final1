const { verifyAccessToken } = require("../utils/jwt");
const { findUserByIdWithRoles } = require("../models/userModel");

async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) {
      return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Missing bearer token" } });
    }

    const payload = verifyAccessToken(token);

    // Hydrate with DB data to enforce RBAC reliably.
    const user = await findUserByIdWithRoles(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid user" } });
    }

    req.user = user;
    return next();
  } catch (e) {
    return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid token" } });
  }
}

module.exports = { authMiddleware };

