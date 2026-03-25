const http = require('http');

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8081,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    const email = "testaccess" + Date.now() + "@gmail.com";
    console.log("1. Signing up Lecturer:", email);
    const signupRes = await request('/auth/signup', 'POST', {
      full_name: "Test Access Lecturer",
      email: email,
      password: "Password123!",
      department_id: "2", // String as in logs
      role: "LECTURER"
    });
    console.log("Signup Status:", signupRes.status);
    if (signupRes.status !== 201) {
        console.error("Signup failed:", signupRes.body);
        return;
    }

    console.log("2. Logging in...");
    const loginRes = await request('/auth/login', 'POST', {
      email: email,
      password: "Password123!"
    });
    console.log("Login Status:", loginRes.status);
    const token = loginRes.body.access_token;
    const userRole = loginRes.body.user.roles[0];
    console.log("Logged in user role:", userRole);

    console.log("3. Fetching Recipients List...");
    const recipientsRes = await request('/dm/recipients', 'GET', null, token);
    console.log("Recipients Status:", recipientsRes.status);
    
    const count = recipientsRes.body.recipients ? recipientsRes.body.recipients.length : 0;
    console.log(`\n>>> FOUND ${count} STUDENTS for this Lecturer. <<<`);
    
    if (count > 0) {
        console.log("VERIFIED: API returns students correctly.");
        console.log("Sample Student:", recipientsRes.body.recipients[0].full_name);
    } else {
        console.log("FAILED: No students returned. Logic issue persists.");
        console.log("Response:", JSON.stringify(recipientsRes.body, null, 2));
    }

  } catch (e) {
    console.error("Test failed:", e);
  }
}

run();
