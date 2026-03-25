const { query } = require("../db");
const { randomUUID } = require("crypto");

async function createTimetableEntry(entry) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO timetable_entries (
      id, course_rep_id, department_id, level_id, group_id,
      course_code, course_title, location, day_of_week, start_time, end_time, notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *;
  `,
    [
      id,
      entry.course_rep_id,
      entry.department_id,
      entry.level_id,
      entry.group_id,
      entry.course_code,
      entry.course_title,
      entry.location,
      entry.day_of_week,
      entry.start_time,
      entry.end_time,
      entry.notes
    ]
  );
  return res.rows[0];
}

async function updateTimetableEntry(id, patch) {
  const res = await query(
    `
    UPDATE timetable_entries
    SET
      course_code = COALESCE($2, course_code),
      course_title = COALESCE($3, course_title),
      location = COALESCE($4, location),
      day_of_week = COALESCE($5, day_of_week),
      start_time = COALESCE($6, start_time),
      end_time = COALESCE($7, end_time),
      notes = COALESCE($8, notes),
      updated_at = now()
    WHERE id = $1
    RETURNING *;
  `,
    [
      id,
      patch.course_code ?? null,
      patch.course_title ?? null,
      patch.location ?? null,
      patch.day_of_week ?? null,
      patch.start_time ?? null,
      patch.end_time ?? null,
      patch.notes ?? null
    ]
  );
  return res.rows[0] || null;
}

async function deleteTimetableEntry(id) {
  await query(`DELETE FROM timetable_entries WHERE id = $1;`, [id]);
}

async function getTimetableForUser(user) {
  // department_id and level_id are NOT NULL on timetable_entries, so we match directly.
  // group_id IS nullable: show entries with no group (whole-level) OR the student's specific group.
  const params = [user.department_id, user.level_id, user.group_id || null];
  const res = await query(
    `
    SELECT *
    FROM timetable_entries
    WHERE
      department_id = $1::int
      AND level_id = $2::int
      AND ($3::int IS NULL OR group_id IS NULL OR group_id = $3::int)
    ORDER BY day_of_week ASC, start_time ASC;
  `,
    params
  );
  return res.rows;
}

async function findTimetableEntryById(id) {
  const res = await query(`SELECT * FROM timetable_entries WHERE id = $1;`, [id]);
  return res.rows[0] || null;
}

module.exports = {
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTimetableForUser,
  findTimetableEntryById
};

