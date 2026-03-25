const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { listUsersController, updateUserController } = require("../controllers/userController");

const userRouter = express.Router();

// Admin user management
userRouter.get("/", authMiddleware, requireRole(["ADMIN"]), listUsersController);
userRouter.patch("/:id", authMiddleware, requireRole(["ADMIN"]), updateUserController);

module.exports = { userRouter };

