// Check actual D1 database schema
const https = require('https');

const ACCOUNT_ID = '4178e03ce554bc3867d9211cd225e665';
const DATABASE_ID = '21fce5cd-8364-4dc2-be7f-6d68cbd6fca9';
const API_TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql });
    
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(result);
          } else {
            reject(new Error(JSON.stringify(result)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function checkSchema() {
  console.log('📊 Checking D1 Database Schema...\n');

  try {
    // Check users table schema
    console.log('1️⃣ Users table schema:');
    const usersSchema = await executeSql("PRAGMA table_info(users)");
    console.log(JSON.stringify(usersSchema.result[0].results, null, 2));

    // Check if projects table has created_by column
    console.log('\n2️⃣ Projects table schema:');
    const projectsSchema = await executeSql("PRAGMA table_info(projects)");
    console.log(JSON.stringify(projectsSchema.result[0].results, null, 2));

    // Check existing data
    console.log('\n3️⃣ Existing users:');
    const users = await executeSql("SELECT * FROM users");
    console.log(JSON.stringify(users.result[0].results, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run check
checkSchema();