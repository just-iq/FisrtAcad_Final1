const { Pool } = require("pg");
const { config } = require("../config/config");

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.db.url });
  }
  return pool;
}

async function query(text, params) {
  return await getPool().query(text, params);
}

module.exports = { getPool, query };

