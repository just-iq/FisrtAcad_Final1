function requireRole(allowedRoles) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const has = roles.some((r) => allowedRoles.includes(r));
    if (!has) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role" } });
    }
    return next();
  };
}

module.exports = { requireRole };

