// Script to fix the admin role
const { getPool } = require("./src/db");

async function fixAdminRole() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Fixing admin role assignment...\n");

    // Get the ADMIN role ID
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = 'ADMIN'",
    );

    if (!roleResult.rows[0]) {
      throw new Error("ADMIN role not found in roles table!");
    }

    const adminRoleId = roleResult.rows[0].id;
    console.log("ADMIN role ID:", adminRoleId);

    // Get the admin user ID
    const userResult = await client.query(
      "SELECT id FROM users WHERE email = 'nsikakadmin@gmail.com'",
    );

    if (!userResult.rows[0]) {
      throw new Error("Admin user not found!");
    }

    const adminUserId = userResult.rows[0].id;
    console.log("Admin user ID:", adminUserId);

    // Delete any existing role assignments
    await client.query("DELETE FROM user_roles WHERE user_id = $1", [
      adminUserId,
    ]);
    console.log("Cleared old role assignments");

    // Insert ADMIN role
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, scope_department_id, scope_level_id, scope_group_id)
       VALUES ($1, $2, NULL, NULL, NULL)`,
      [adminUserId, adminRoleId],
    );
    console.log("Assigned ADMIN role");

    // Verify
    const verifyResult = await client.query(
      `
      SELECT r.name 
      FROM user_roles ur 
      JOIN roles r ON r.id = ur.role_id 
      WHERE ur.user_id = $1
    `,
      [adminUserId],
    );

    console.log("\n✅ Admin role fixed!");
    console.log("Verified role:", verifyResult.rows[0].name);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAdminRole();
