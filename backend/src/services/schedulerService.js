const cron = require("node-cron");
const notificationService = require("./notificationService");

/**
 * Initialize scheduled tasks
 */
function initScheduler() {
  console.log("Initializing scheduler...");

  // Run every 30 minutes — generates reminders for classes starting in the next 90 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      await notificationService.generateAllReminders(false);
    } catch (err) {
      console.error("Scheduled reminder task failed:", err);
    }
  });

  console.log("Scheduler initialized. Jobs scheduled.");
}

module.exports = {
  initScheduler
};
