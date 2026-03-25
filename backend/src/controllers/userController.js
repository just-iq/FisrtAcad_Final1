const { listUsers, updateUser } = require("../services/userService");

async function listUsersController(req, res, next) {
  try {
    const users = await listUsers(req.query || {});
    return res.json({ users });
  } catch (e) {
    return next(e);
  }
}

async function updateUserController(req, res, next) {
  try {
    const user = await updateUser(req.params.id, req.body || {});
    return res.json({ user });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listUsersController, updateUserController };

