const { query } = require("../db");

async function getRoleIdsByNames(names) {
  const res = await query(`SELECT id, name FROM roles WHERE name = ANY($1::text[]);`, [names]);
  const found = new Map(res.rows.map((r) => [r.name, r.id]));
  const missing = names.filter((n) => !found.has(n));
  if (missing.length) {
    const err = new Error(`Unknown roles: ${missing.join(", ")}`);
    err.statusCode = 400;
    err.code = "UNKNOWN_ROLE";
    throw err;
  }
  return names.map((n) => found.get(n));
}

async function getRoleIdByName(name) {
  const res = await query(`SELECT id FROM roles WHERE name = $1;`, [name]);
  if (!res.rows[0]) {
    const err = new Error(`Unknown role: ${name}`);
    err.statusCode = 400;
    err.code = "UNKNOWN_ROLE";
    throw err;
  }
  return res.rows[0].id;
}

module.exports = { getRoleIdsByNames, getRoleIdByName };

