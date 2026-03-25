const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { recommendResourcesController } = require("../controllers/recommendationController");

const recommendationRouter = express.Router();

recommendationRouter.get("/resources/:student_id", authMiddleware, recommendResourcesController);

module.exports = { recommendationRouter };

