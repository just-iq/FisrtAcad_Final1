const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
  createEventController,
  listEventsController,
} = require("../controllers/eventController");

const eventRouter = express.Router();

// Public read or protected read? Let's make it protected for now as platform is closed
eventRouter.get("/", authMiddleware, listEventsController);

// Only specific roles should create? For now allow any auth user, but frontend limits to Exec
eventRouter.post("/", authMiddleware, createEventController);

module.exports = { eventRouter };
