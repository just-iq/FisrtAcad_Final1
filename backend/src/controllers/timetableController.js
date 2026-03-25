const { createEntry, updateEntry, removeEntry, fetchTimetable, triggerNotification } = require("../services/timetableService");

async function getTimetableController(req, res, next) {
  try {
    const entries = await fetchTimetable(req.user);
    return res.json({ timetable: entries });
  } catch (e) {
    return next(e);
  }
}

async function createTimetableController(req, res, next) {
  try {
    const entry = await createEntry(req.user, req.body || {});
    return res.status(201).json({ entry });
  } catch (e) {
    return next(e);
  }
}

async function updateTimetableController(req, res, next) {
  try {
    const entry = await updateEntry(req.user, req.params.id, req.body || {});
    return res.json({ entry });
  } catch (e) {
    return next(e);
  }
}

async function deleteTimetableController(req, res, next) {
  try {
    await removeEntry(req.user, req.params.id);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function triggerTimetableController(req, res, next) {
  try {
    const { type } = req.body || {};
    const result = await triggerNotification(req.user, req.params.id, type);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getTimetableController,
  createTimetableController,
  updateTimetableController,
  deleteTimetableController,
  triggerTimetableController
};

