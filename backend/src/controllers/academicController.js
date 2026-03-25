const { getPool } = require("../db");

async function listDepartments(req, res, next) {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT id, name FROM departments ORDER BY name ASC;");
    return res.json({ departments: result.rows });
  } catch (e) {
    return next(e);
  }
}

async function listLevels(req, res, next) {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT id, name, "order" FROM levels ORDER BY "order" ASC;');
    return res.json({ levels: result.rows });
  } catch (e) {
    return next(e);
  }
}

async function listGroups(req, res, next) {
  try {
    const { department_id, level_id } = req.query;
    const pool = getPool();
    const params = [];
    const where = [];
    
    if (department_id) {
      params.push(department_id);
      where.push(`department_id = $${params.length}`);
    }
    if (level_id) {
      params.push(level_id);
      where.push(`level_id = $${params.length}`);
    }
    
    const queryStr = `
      SELECT id, name, department_id, level_id 
      FROM groups 
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY name ASC;
    `;
    const result = await pool.query(queryStr, params);
    return res.json({ groups: result.rows });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listDepartments, listLevels, listGroups };
