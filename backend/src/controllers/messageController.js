const { sendMessage, listMessages } = require("../services/messageService");

async function sendMessageController(req, res, next) {
  try {
    const message = await sendMessage(req.user, req.body || {});
    return res.status(201).json({ message });
  } catch (e) {
    return next(e);
  }
}

async function listMessagesController(req, res, next) {
  try {
    const { limit, before } = req.query || {};
    const messages = await listMessages(req.user, { limit, before });
    return res.json({ messages });
  } catch (e) {
    return next(e);
  }
}

module.exports = { sendMessageController, listMessagesController };

