const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Maritime@localhost:5432/first_acad',
});

async function checkUser(email) {
  await client.connect();
  const res = await client.query(
    'SELECT email, is_active FROM users WHERE email = $1',
    [email]
  );
  console.log(res.rows);
  await client.end();
}

checkUser('nsikakadmin@gmail.com');

