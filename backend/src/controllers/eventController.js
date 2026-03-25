const { createEvent, listEvents } = require("../models/eventModel");
const { getIo } = require("../sockets");

async function createEventController(req, res, next) {
  try {
    const { title, description, date, time, venue, department_id } = req.body;
    const userId = req.user.id; // From authMiddleware

    if (!title || !date || !time || !venue) {
      const err = new Error("Missing required fields");
      err.statusCode = 400;
      throw err;
    }

    const event = await createEvent({
      title,
      description,
      date,
      time,
      venue,
      department_id: department_id === "all" ? null : department_id,
      created_by: userId
    });

    // Broadcast to affected rooms
    try {
      const io = getIo();
      io.to("school_global").emit("event:new", event);
    } catch (_) {}

    return res.status(201).json({ event });
  } catch (e) {
    return next(e);
  }
}

async function listEventsController(req, res, next) {
  try {
    const { department_id } = req.query;
    const events = await listEvents(department_id);
    return res.json({ events });
  } catch (e) {
    return next(e);
  }
}

module.exports = { createEventController, listEventsController };
