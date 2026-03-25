const { query } = require("../db");
const { randomUUID } = require("crypto");

async function createEvent({ title, description, date, time, venue, department_id, created_by }) {
  const id = randomUUID();
  const res = await query(
    `INSERT INTO events (id, title, description, date, time, venue, department_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *;`,
    [id, title, description, date, time, venue, department_id, created_by]
  );
  return res.rows[0];
}

async function listEvents(department_id = null) {
  let sql = `
    SELECT e.*, d.name as department_name, u.full_name as organizer
    FROM events e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN users u ON e.created_by = u.id
  `;
  const params = [];
  
  if (department_id) {
    sql += ` WHERE (e.department_id = $1::int OR e.department_id IS NULL) AND e.date >= CURRENT_DATE`;
    params.push(department_id);
  } else {
    // No dept filter: only global events
    sql += ` WHERE e.department_id IS NULL AND e.date >= CURRENT_DATE`;
  }

  sql += ` ORDER BY e.date ASC, e.time ASC;`;
  
  const res = await query(sql, params);
  return res.rows;
}

module.exports = { createEvent, listEvents };
