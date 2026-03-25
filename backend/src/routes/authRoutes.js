const express = require("express");
const { loginController, registerController, signupController } = require("../controllers/authController");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

const authRouter = express.Router();

authRouter.post("/login", loginController);

// Public signup (Student only)
authRouter.post("/signup", signupController);

// Admin-only user creation (strict requirement)
authRouter.post("/register", authMiddleware, requireRole(["ADMIN"]), registerController);

module.exports = { authRouter };

