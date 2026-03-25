const fs = require("fs");
const path = require("path");
const { getPool } = require("./index"); // make sure this exports a fresh Pool instance

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Ensure the migrations table exists
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Get migrations that have already been applied
async function getAppliedMigrations(client) {
  const res = await client.query(
    `SELECT filename FROM schema_migrations ORDER BY filename ASC;`,
  );
  return new Set(res.rows.map((r) => r.filename));
}

// List all SQL files in the migrations directory
function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// Apply a single migration file
async function applyMigration(client, filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(fullPath, "utf8");
  if (!sql.trim()) return;

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1);`,
      [filename],
    );
    await client.query("COMMIT");
    console.log(`Applied migration: ${filename}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`Failed migration: ${filename}`);
    throw e;
  }
}

// Main migration runner
async function migrate(shouldClosePool = false) {
  const pool = getPool(); // get the singleton Pool instance
  const client = await pool.connect();
  console.log("Connected to database, starting migrations...");

  try {
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = listMigrationFiles();

    for (const f of files) {
      if (!applied.has(f)) {
        console.log(`Applying migration: ${f}`);
        await applyMigration(client, f);
      } else {
        console.log(`Skipping already applied migration: ${f}`);
      }
    }

    console.log("All migrations complete!");
  } catch (e) {
    console.error("Migration error:", e);
    throw e;
  } finally {
    client.release();
    // Only close pool if this is run directly, not when called by seed.js
    if (shouldClosePool) {
      await pool.end();
      console.log("Database connection closed.");
    }
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  migrate(true).catch((e) => {
    console.error("Unexpected error:", e);
    process.exit(1);
  });
}

module.exports = { migrate };
