const { query } = require("./src/db");
const { getRoleIdByName } = require("./src/models/roleModel");

async function run() {
  console.log("Running migration: fix_rep_exec_student_roles...");
  
  try {
    const studentRoleId = await getRoleIdByName("STUDENT");
    
    // Find users with REP/EXEC but no STUDENT role
    const res = await query(`
      SELECT u.id 
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('COURSE_REP', 'STUDENT_EXEC')
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur2 
        JOIN roles r2 ON r2.id = ur2.role_id 
        WHERE ur2.user_id = u.id AND r2.name = 'STUDENT'
      )
      GROUP BY u.id;
    `);
    
    console.log(`Found ${res.rows.length} users to fix.`);
    
    for (const r of res.rows) {
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.id, studentRoleId]);
      console.log(`Fixed user ${r.id}`);
    }
    
    console.log("Migration complete.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
