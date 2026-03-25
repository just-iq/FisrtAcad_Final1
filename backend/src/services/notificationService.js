const {
  createNotification,
  createNotificationsBatch,
  getNotificationsForUser,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  notificationExists
} = require("../models/notificationModel");
const { getTimetableForUser } = require("../models/timetableModel");
const { listAssignmentsForUser } = require("../models/assignmentModel");
const { query } = require("../db");
const { getIo } = require("../sockets");
const pushService = require("./pushService");

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

/**
 * Get notifications for the current user
 */
async function list(user, queryParams = {}) {
  const { unreadOnly, limit, before } = queryParams;
  return await getNotificationsForUser(user.id, {
    unreadOnly: unreadOnly === "true" || unreadOnly === true,
    limit,
    before
  });
}

/**
 * Mark a notification as read
 */
async function read(user, notificationId) {
  const result = await markAsRead(notificationId, user.id);
  if (!result) throw badRequest("Notification not found", "NOT_FOUND");
  return result;
}

/**
 * Mark all notifications as read
 */
async function readAll(user) {
  const count = await markAllAsRead(user.id);
  return { marked: count };
}

/**
 * Get unread count for the current user
 */
async function unreadCount(user) {
  const count = await getUnreadCount(user.id);
  return { count };
}

/**
 * Generate class reminders for users based on timetable
 * Finds classes happening within the next N hours and creates reminders
 */
// fullWeek=true → generate reminders for all classes this week (used by manual trigger)
// fullWeek=false → only classes starting in the next hoursAhead (used by cron)
async function generateClassReminders(hoursAhead = 1, fullWeek = false) {
  // Get all users that have timetable entries matching their dept/level/group
  const usersWithTimetables = await query(`
    SELECT DISTINCT u.id, u.department_id, u.level_id, u.group_id
    FROM users u
    INNER JOIN timetable_entries t ON
      t.department_id = u.department_id AND
      t.level_id = u.level_id AND
      (t.group_id IS NULL OR t.group_id = u.group_id)
    WHERE u.is_active = true
      AND u.department_id IS NOT NULL
      AND u.level_id IS NOT NULL
  `);

  const now = new Date();
  // DB day_of_week: 0=Monday … 4=Friday
  // JS getDay():    0=Sunday, 1=Monday … 5=Friday, 6=Saturday
  const jsDow = now.getDay();
  const todayDayOfWeek = jsDow === 0 || jsDow === 6 ? null : jsDow - 1;

  let daysToGenerate;
  if (fullWeek) {
    // Generate for every remaining weekday this week (Mon–Fri)
    if (todayDayOfWeek === null) {
      // Weekend — generate for all of next Mon–Fri
      daysToGenerate = [0, 1, 2, 3, 4];
    } else {
      daysToGenerate = [0, 1, 2, 3, 4]; // all weekdays
    }
  } else {
    if (todayDayOfWeek === null) return { classRemindersCreated: 0 };
    daysToGenerate = [todayDayOfWeek];
  }

  const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
  const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toTimeString().slice(0, 8);

  let notificationsCreated = 0;

  for (const user of usersWithTimetables.rows) {
    for (const dow of daysToGenerate) {
      // For cron: filter by time window. For full-week scan: no time filter.
      const entries = await query(
        fullWeek
          ? `SELECT * FROM timetable_entries
             WHERE department_id = $1 AND level_id = $2
               AND (group_id IS NULL OR group_id = $3)
               AND day_of_week = $4
             ORDER BY start_time ASC`
          : `SELECT * FROM timetable_entries
             WHERE department_id = $1 AND level_id = $2
               AND (group_id IS NULL OR group_id = $3)
               AND day_of_week = $4
               AND start_time >= $5::time
               AND start_time <= $6::time
             ORDER BY start_time ASC`,
        fullWeek
          ? [user.department_id, user.level_id, user.group_id, dow]
          : [user.department_id, user.level_id, user.group_id, dow, currentTime, futureTime]
      );

      // Calculate the actual date for this day-of-week
      // dow 0=Mon … 4=Fri; jsDow 1=Mon … 5=Fri
      const targetJsDow = dow + 1;
      const currentJsDow = now.getDay() === 0 ? 7 : now.getDay(); // treat Sunday as 7
      const dayDiff = targetJsDow - (now.getDay() === 0 ? 7 : now.getDay());
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + (fullWeek ? dayDiff : 0));
      const dateStr = targetDate.toISOString().slice(0, 10);

      for (const entry of entries.rows) {
        const timeStr = String(entry.start_time).slice(0, 8);
        const scheduledFor = new Date(`${dateStr}T${timeStr}`);

        const existing = await notificationExists(user.id, 'CLASS_REMINDER', entry.id, scheduledFor);

        let n;
        if (!existing) {
          // First time seeing this class today — create the DB record
          n = await createNotification({
            user_id: user.id,
            type: 'CLASS_REMINDER',
            title: `Class: ${entry.course_code}`,
            message: `${entry.course_title} — ${['Mon','Tue','Wed','Thu','Fri'][dow]} at ${timeStr.slice(0,5)}${entry.location ? ` in ${entry.location}` : ''}`,
            related_id: entry.id,
            scheduled_for: scheduledFor
          });
          notificationsCreated++;
        } else if (!fullWeek) {
          // Cron path: record already exists but still emit the reminder alert
          // (covers the case where user clicked "Check for reminders" earlier today)
          n = existing;
        } else {
          // Manual full-week scan: record exists, skip — Notifications page handles display
          continue;
        }

        try { getIo().to(`user_${user.id}`).emit('notification:new', n); } catch (_) {}
        pushService.sendToUser(user.id, { title: n.title, message: n.message, type: n.type, url: '/notifications' }).catch(() => {});
      }
    }
  }

  return { classRemindersCreated: notificationsCreated };
}

/**
 * Generate assignment deadline reminders
 * Finds assignments due within N days and creates reminders
 */
async function generateAssignmentReminders(daysAhead = 2) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Get assignments with upcoming deadlines
  const assignments = await query(`
    SELECT a.*, 
           u.id as student_id, u.department_id as user_dept, u.level_id as user_level, u.group_id as user_group
    FROM assignments a
    CROSS JOIN users u
    WHERE a.due_at IS NOT NULL
      AND a.due_at > $1
      AND a.due_at <= $2
      AND u.is_active = true
      AND (a.department_id IS NULL OR a.department_id = u.department_id)
      AND (a.level_id IS NULL OR a.level_id = u.level_id)
      AND (a.group_id IS NULL OR a.group_id = u.group_id)
      AND NOT EXISTS (
        SELECT 1 FROM submissions s 
        WHERE s.assignment_id = a.id AND s.student_id = u.id AND s.is_latest = true
      )
  `, [now, futureDate]);

  let notificationsCreated = 0;

  for (const row of assignments.rows) {
    // Use assignment due date as scheduled_for
    const scheduledFor = new Date(row.due_at);

    // Check if notification already exists
    const exists = await notificationExists(row.student_id, 'ASSIGNMENT_DEADLINE', row.id, scheduledFor);
    if (exists) continue;

    const dueDate = new Date(row.due_at);
    const hoursUntilDue = Math.round((dueDate - now) / (1000 * 60 * 60));
    const daysUntilDue = Math.ceil(hoursUntilDue / 24);

    let timeText;
    if (hoursUntilDue < 24) {
      timeText = `${hoursUntilDue} hours`;
    } else if (daysUntilDue === 1) {
      timeText = "tomorrow";
    } else {
      timeText = `${daysUntilDue} days`;
    }

    const n = await createNotification({
      user_id: row.student_id,
      type: 'ASSIGNMENT_DEADLINE',
      title: `Assignment Due: ${row.title}`,
      message: `This assignment is due in ${timeText}. Don't forget to submit!`,
      related_id: row.id,
      scheduled_for: scheduledFor
    });
    try { getIo().to(`user_${row.student_id}`).emit('notification:new', n); } catch (_) {}
    pushService.sendToUser(row.student_id, { title: n.title, message: n.message, type: n.type, url: '/notifications' }).catch(() => {});
    notificationsCreated++;
  }

  return { assignmentRemindersCreated: notificationsCreated };
}

/**
 * Generate all reminders (called by cron or API)
 */
// manualTrigger = true → full week of classes + 7-day assignment window
async function generateAllReminders(manualTrigger = false) {
  // Cron uses 1.5 hours so a class at 1pm is caught at both 11:30 and 12:00 runs
  const classResult = await generateClassReminders(1.5, manualTrigger);
  const assignmentResult = await generateAssignmentReminders(manualTrigger ? 7 : 2);
  return {
    ...classResult,
    ...assignmentResult
  };
}

/**
 * Create persistent ANNOUNCEMENT notifications for all users in the announcement's scope.
 * Called fire-and-forget after an announcement is posted so users see it in their
 * notification bell even if they were offline at posting time.
 */
async function createAnnouncementNotifications(announcement) {
  const { id: related_id, title, channel_type, department_id, level_id, group_id, created_at } = announcement;

  let usersRes;
  if (channel_type === "SCHOOL") {
    usersRes = await query(`SELECT id FROM users WHERE is_active = true`);
  } else if (channel_type === "DEPARTMENT_LEVEL" && department_id) {
    if (level_id) {
      usersRes = await query(
        `SELECT id FROM users WHERE is_active = true AND department_id = $1::int AND level_id = $2::int`,
        [department_id, level_id]
      );
    } else {
      // No level filter — send to all levels in this department
      usersRes = await query(
        `SELECT id FROM users WHERE is_active = true AND department_id = $1::int`,
        [department_id]
      );
    }
  } else if (channel_type === "GROUP" && group_id) {
    usersRes = await query(
      `SELECT id FROM users WHERE is_active = true AND group_id = $1::int`,
      [group_id]
    );
  } else {
    return;
  }

  if (!usersRes.rows.length) return;

  const scheduledFor = new Date(created_at || Date.now());
  const notifications = usersRes.rows.map((u) => ({
    user_id: u.id,
    type: "ANNOUNCEMENT",
    title: "New Announcement",
    message: title,
    related_id,
    scheduled_for: scheduledFor
  }));

  const created = await createNotificationsBatch(notifications);

  // Push real-time notification:new event to each user's personal room
  try {
    const io = getIo();
    created.forEach((n) => io.to(`user_${n.user_id}`).emit("notification:new", n));
  } catch (_) {
    // Socket not critical — ignore if unavailable
  }

  // Web push — fire-and-forget per user
  created.forEach((n) => {
    pushService.sendToUser(n.user_id, {
      title: n.title,
      message: n.message,
      type: n.type,
      url: "/announcements"
    }).catch(() => {});
  });
}

module.exports = {
  list,
  read,
  readAll,
  unreadCount,
  generateClassReminders,
  generateAssignmentReminders,
  generateAllReminders,
  createAnnouncementNotifications
};
