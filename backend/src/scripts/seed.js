const { getPool } = require("../db");
const { migrate } = require("../db/migrate");
const { hashPassword } = require("../utils/password");
const { randomUUID } = require("crypto");

// ---- Upsert helpers ----
async function upsertDepartment(client, name) {
  const res = await client.query(
    `INSERT INTO departments (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [name],
  );
  return res.rows[0].id;
}

async function upsertLevel(client, name, order) {
  const res = await client.query(
    `INSERT INTO levels (name, "order") VALUES ($1,$2)
     ON CONFLICT (name) DO UPDATE SET "order" = EXCLUDED."order"
     RETURNING id;`,
    [name, order],
  );
  return res.rows[0].id;
}

async function upsertGroup(client, department_id, level_id, name) {
  const res = await client.query(
    `INSERT INTO groups (department_id, level_id, name) VALUES ($1,$2,$3)
     ON CONFLICT (department_id, level_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [department_id, level_id, name],
  );
  return res.rows[0].id;
}

async function getRoleId(client, name) {
  const res = await client.query(`SELECT id FROM roles WHERE name = $1;`, [name]);
  if (!res.rows[0]) throw new Error(`Role not found: ${name}. Did you run migrations?`);
  return res.rows[0].id;
}

/**
 * Creates or updates a user and assigns one or more roles.
 * Mirrors the signup flow: department → level → group → role assignment.
 *
 * @param {object} opts
 * @param {string[]} opts.roleNames - e.g. ["STUDENT"] or ["COURSE_REP", "STUDENT"]
 * @param {string|null} opts.department_id
 * @param {string|null} opts.level_id
 * @param {string|null} opts.group_id
 */
async function createUserWithPrehashedPassword(
  client,
  { email, full_name, password_hash, department_id, level_id, group_id, roleNames },
) {
  const id = randomUUID();

  await client.query(
    `INSERT INTO users (id, email, password_hash, full_name, department_id, level_id, group_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
     ON CONFLICT (email) DO UPDATE SET
       full_name       = EXCLUDED.full_name,
       password_hash   = EXCLUDED.password_hash,
       department_id   = EXCLUDED.department_id,
       level_id        = EXCLUDED.level_id,
       group_id        = EXCLUDED.group_id,
       updated_at      = now();`,
    [id, email, password_hash, full_name, department_id, level_id, group_id],
  );

  const userRes = await client.query(`SELECT id FROM users WHERE email = $1;`, [email]);
  const userId = userRes.rows[0].id;

  // Clear existing roles and re-assign (idempotent re-seed)
  await client.query(`DELETE FROM user_roles WHERE user_id = $1;`, [userId]);

  for (const roleName of roleNames) {
    const roleId = await getRoleId(client, roleName);
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, scope_department_id, scope_level_id, scope_group_id)
       VALUES ($1, $2, $3, $4, $5);`,
      [userId, roleId, department_id, level_id, group_id],
    );
  }

  return userId;
}

// ---- Main seed ----
async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await migrate(false);
    await client.query("BEGIN");

    // ---- 1. Departments ----
    console.log("Setting up departments...");
    const departmentNames = [
      "Computer Science",
      "Computer Science (Information Systems)",
      "Computer Science (Technology)",
      "Information Technology",
      "Software Engineering",
    ];
    const departmentIds = [];
    for (const name of departmentNames) {
      departmentIds.push(await upsertDepartment(client, name));
    }

    // ---- 2. Levels (mirrors what the signup dropdown shows) ----
    console.log("Setting up levels...");
    const levelDefs = [
      { name: "100 Level", order: 100 },
      { name: "200 Level", order: 200 },
      { name: "300 Level", order: 300 },
      { name: "400 Level", order: 400 },
      { name: "500 Level", order: 500 },
    ];
    const levelIds = [];
    for (const l of levelDefs) {
      levelIds.push(await upsertLevel(client, l.name, l.order));
    }

    // ---- 3. Groups (A, B, C, D for every dept × level combination) ----
    console.log("Setting up groups...");
    const groupNames = ["Group A", "Group B", "Group C", "Group D"];
    // groups[deptIdx][levelIdx][groupIdx] = group_id
    const groups = [];
    for (const deptId of departmentIds) {
      const byLevel = [];
      for (const levelId of levelIds) {
        const byGroup = [];
        for (const gName of groupNames) {
          byGroup.push(await upsertGroup(client, deptId, levelId, gName));
        }
        byLevel.push(byGroup);
      }
      groups.push(byLevel);
    }

    // ---- 4. Hash password once ----
    const password = "Password123!";
    console.log("Hashing password...");
    const password_hash = await hashPassword(password);

    // ---- 5. Users (mirrors the signup flow per role) ----
    console.log("Creating users...");

    /**
     * Seed user definitions.
     * Each entry produces `count` users spread across dept[0..count-1], level[levelIdx], group[groupIdx].
     *
     * roleNames: what roles get assigned (STUDENT base role added automatically for COURSE_REP / STUDENT_EXEC)
     * needsAcademic: whether dept/level/group should be set (false for ADMIN / LECTURER)
     */
    const userDefs = [
      // Admin — no academic placement (not available on signup; admin-only creation)
      {
        prefix: "mofeadmin",
        roleNames: ["ADMIN"],
        needsAcademic: false,
        count: 1,
        levelIdx: null,
        groupIdx: null,
      },
      // Lecturer — can belong to a department but no level/group (not in signup, but scoped)
      {
        prefix: "mofelecturer",
        roleNames: ["LECTURER"],
        needsAcademic: false,
        count: 3,
        levelIdx: null,
        groupIdx: null,
      },
      // Student Exec — STUDENT + STUDENT_EXEC, placed in 100 Level Group A
      {
        prefix: "mofeexecutive",
        roleNames: ["STUDENT_EXEC", "STUDENT"],
        needsAcademic: true,
        count: 3,
        levelIdx: 0, // 100 Level
        groupIdx: 0, // Group A
      },
      // Course Rep — STUDENT + COURSE_REP, placed in 200 Level Group B
      {
        prefix: "mofecourserep",
        roleNames: ["COURSE_REP", "STUDENT"],
        needsAcademic: true,
        count: 3,
        levelIdx: 1, // 200 Level
        groupIdx: 1, // Group B
      },
      // Regular students spread across levels and groups
      {
        prefix: "mofestudent",
        roleNames: ["STUDENT"],
        needsAcademic: true,
        count: 3,
        levelIdx: 2, // 300 Level
        groupIdx: 2, // Group C
      },
    ];

    let userCount = 0;
    const totalUsers = userDefs.reduce((s, u) => s + u.count, 0);

    for (const def of userDefs) {
      for (let i = 0; i < def.count; i++) {
        const num = i + 1;
        const suffix = num === 1 ? "" : ` ${num}`;
        const email = `${def.prefix}${num === 1 ? "" : String(num)}@gmail.com`;

        const formatRoleName = (r) => {
          if (r === "STUDENT_EXEC") return "Student Exec";
          if (r === "COURSE_REP") return "Course Rep";
          return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
        };
        // Use the first (primary) role for display name
        const displayRole = formatRoleName(def.roleNames[0]);
        const full_name = `Mofe ${displayRole}${suffix}`;

        // Spread users across departments deterministically
        const deptIdx = i % departmentIds.length;
        const deptId = departmentIds[deptIdx];

        let department_id = null;
        let level_id = null;
        let group_id = null;

        if (def.needsAcademic) {
          department_id = deptId;
          level_id = levelIds[def.levelIdx];
          group_id = groups[deptIdx][def.levelIdx][def.groupIdx];
        }

        await createUserWithPrehashedPassword(client, {
          email,
          full_name,
          password_hash,
          department_id,
          level_id,
          group_id,
          roleNames: def.roleNames,
        });

        userCount++;
        process.stdout.write(`\rCreated ${userCount}/${totalUsers} users...`);
      }
    }
    console.log();

    await client.query("COMMIT");

    console.log("\n✅ Seed complete!");
    console.log(`📊 Created ${totalUsers} users across ${departmentNames.length} departments, ${levelDefs.length} levels, ${groupNames.length} groups each`);
    console.log("🔑 Password for all users:", password);
    console.log("\n📧 Example logins:");
    console.log("   Admin:       mofeadmin@gmail.com");
    console.log("   Lecturer:    mofelecturer@gmail.com");
    console.log("   Student Exec: mofeexecutive@gmail.com");
    console.log("   Course Rep:  mofecourserep@gmail.com");
    console.log("   Student:     mofestudent@gmail.com");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding error:", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
    console.log("\n🔌 Database connection closed.");
  }
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { seed };
