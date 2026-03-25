const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { upload } = require("../middleware/upload");
const {
  createResourceController,
  listResourcesController,
  getResourceController,
  recordResourceViewController
} = require("../controllers/resourceController");

const resourceRouter = express.Router();

resourceRouter.get("/", authMiddleware, listResourcesController);
resourceRouter.get("/:id", authMiddleware, getResourceController);
resourceRouter.post("/", authMiddleware, requireRole(["LECTURER"]), upload.single("file"), createResourceController);

// Interaction tracking for recommendations
resourceRouter.post("/:id/interactions", authMiddleware, recordResourceViewController);

module.exports = { resourceRouter };

