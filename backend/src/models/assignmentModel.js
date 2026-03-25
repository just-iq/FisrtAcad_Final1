const { query } = require("../db");
const { randomUUID } = require("crypto");

async function createAssignment(a) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO assignments (
      id, lecturer_id, title, description, department_id, level_id, group_id, due_at, permit_resubmission
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *;
  `,
    [
      id,
      a.lecturer_id,
      a.title,
      a.description,
      a.department_id,
      a.level_id,
      a.group_id,
      a.due_at,
      a.permit_resubmission || false
    ]
  );
  return res.rows[0];
}

async function listAssignmentsForUser(user, { limit = 50 } = {}) {
  const params = [
    user.department_id || null, 
    user.level_id || null, 
    user.group_id || null, 
    Math.min(Number(limit) || 50, 100),
    user.id
  ];
  
  const res = await query(
    `
    SELECT a.*, 
           CASE WHEN s.id IS NOT NULL THEN TRUE ELSE FALSE END as is_submitted,
           s.submitted_at
    FROM assignments a
    LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = $5 AND s.is_latest = TRUE
    WHERE
      (a.department_id IS NULL OR a.department_id = $1)
      AND (a.level_id IS NULL OR a.level_id = $2)
      AND (a.group_id IS NULL OR a.group_id = $3)
    ORDER BY a.created_at DESC
    LIMIT $4;
  `,
    params
  );
  return res.rows;
}

async function getAssignmentById(id) {
  const res = await query(`SELECT * FROM assignments WHERE id = $1;`, [id]);
  return res.rows[0] || null;
}

async function setPermitResubmission(id, permit_resubmission) {
  const res = await query(
    `
    UPDATE assignments
    SET permit_resubmission = $2, updated_at = now()
    WHERE id = $1
    RETURNING *;
  `,
    [id, !!permit_resubmission]
  );
  return res.rows[0] || null;
}

async function createSubmission(s) {
  const id = randomUUID();
  const res = await query(
    `
    INSERT INTO submissions (id, assignment_id, student_id, file_key, mime_type, size_bytes, is_latest)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *;
  `,
    [id, s.assignment_id, s.student_id, s.file_key, s.mime_type, s.size_bytes, s.is_latest ?? true]
  );
  return res.rows[0];
}

async function countSubmissions(assignment_id, student_id) {
  const res = await query(`SELECT COUNT(*)::int AS c FROM submissions WHERE assignment_id = $1 AND student_id = $2;`, [
    assignment_id,
    student_id
  ]);
  return res.rows[0]?.c || 0;
}

async function markPreviousNotLatest(assignment_id, student_id) {
  await query(`UPDATE submissions SET is_latest = FALSE WHERE assignment_id = $1 AND student_id = $2;`, [assignment_id, student_id]);
}

async function listSubmissionsForAssignment(assignment_id) {
  const res = await query(
    `
    SELECT s.*, u.full_name as student_name, u.email as student_email
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    WHERE s.assignment_id = $1
    ORDER BY s.submitted_at DESC;
    `,
    [assignment_id]
  );
  return res.rows;
}

module.exports = {
  createAssignment,
  listAssignmentsForUser,
  getAssignmentById,
  setPermitResubmission,
  createSubmission,
  countSubmissions,
  markPreviousNotLatest,
  listSubmissionsForAssignment
};

