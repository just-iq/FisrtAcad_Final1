const { Client } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log("--- 1. Inspecting Lecturers ---");
    // Find all lecturers
    const lecturersRes = await client.query(`
      SELECT u.id, u.email, u.full_name, u.department_id, u.created_at
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'LECTURER'
      ORDER BY u.created_at DESC
      LIMIT 5
    `);
    
    if (lecturersRes.rows.length === 0) {
      console.log("NO LECTURERS FOUND! The signup fix failed or no one signed up as Lecturer.");
    } else {
      lecturersRes.rows.forEach(l => {
        console.log(`Lecturer: ${l.email}, Dept: ${l.department_id} (Type: ${typeof l.department_id})`);
      });
    }

    // Pick the most recent lecturer for testing
    const lecturer = lecturersRes.rows[0];
    if (!lecturer) {
        console.log("Cannot run visibility test without a lecturer.");
        return;
    }

    const deptId = lecturer.department_id;
    console.log(`\n--- 2. Inspecting Students in Dept ${deptId} ---`);
    
    const studentsRes = await client.query(`
      SELECT u.id, u.email, u.department_id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('STUDENT', 'COURSE_REP', 'STUDENT_EXEC')
      AND u.department_id = $1
    `, [deptId]);
    
    console.log(`Found ${studentsRes.rows.length} students in Dept ${deptId}.`);
    studentsRes.rows.forEach(s => console.log(` - Student: ${s.email}, Dept: ${s.department_id}`));

    if (studentsRes.rows.length === 0) {
        console.log("ISSUE: No students found in this department. Lecturer cannot see anyone.");
        
        // Check if there are ANY students
        const anyStudent = await client.query(`
             SELECT u.id, u.email, u.department_id
              FROM users u
              JOIN user_roles ur ON ur.user_id = u.id
              JOIN roles r ON r.id = ur.role_id
              WHERE r.name = 'STUDENT' LIMIT 5
        `);
        console.log("Sample of ANY students in DB:", anyStudent.rows.map(s => `${s.email} (Dept: ${s.department_id})`).join(", "));
    } else {
        console.log("\n--- 3. Testing Recipient Query Logic ---");
        // Simulate the query from dmModel.js
        console.log("Executing exact SQL from dmModel.js with Lecturer ID:", lecturer.id, "Dept:", deptId);
        
        const params = [lecturer.id, 50, deptId]; // id != $1, limit $2, dept = $3
        const roleFilter = `
          EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = u.id AND r.name IN ('STUDENT', 'COURSE_REP', 'STUDENT_EXEC')
          )
        `;
        
        const querySQL = `
            SELECT u.id, u.full_name, u.email
            FROM users u
            WHERE u.id != $1 
              AND u.is_active = true
              AND ${roleFilter}
              AND u.department_id = $3
            ORDER BY u.full_name ASC
            LIMIT $2;
        `;
        
        const testRes = await client.query(querySQL, params);
        console.log(`Query returned ${testRes.rows.length} results.`);
        testRes.rows.forEach(r => console.log(` -> Found: ${r.email}`));
        
        if (testRes.rows.length > 0) {
            console.log("SUCCESS: Logic is correct. If user can't see students, it's an API/Context issue (e.g. token payload missing dept_id).");
        } else {
            console.log("FAILURE: Logic returned no results despite students existing.");
        }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
