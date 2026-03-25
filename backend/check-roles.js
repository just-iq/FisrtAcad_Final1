// Quick script to check what roles are assigned to users
const { getPool } = require("./src/db");

async function checkRoles() {
  const pool = getPool();

  try {
    console.log("Checking user roles in database...\n");

    const result = await pool.query(`
      SELECT 
        u.email,
        u.full_name,
        array_agg(r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.email IN (
        'nsikakadmin@gmail.com',
        'nsikaklecturer@gmail.com',
        'nsikakexecutive@gmail.com',
        'nsikakcourserep@gmail.com',
        'nsikakstudent@gmail.com'
      )
      GROUP BY u.id, u.email, u.full_name
      ORDER BY u.email;
    `);

    console.log("Current role assignments:");
    console.log("========================");
    result.rows.forEach((row) => {
      console.log(`${row.email.padEnd(35)} => ${row.roles.join(", ")}`);
    });

    console.log("\n✅ Check complete");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkRoles();
