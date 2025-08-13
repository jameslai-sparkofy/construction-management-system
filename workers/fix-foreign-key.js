// Fix foreign key constraint by creating a system user
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
            console.log('✅ SQL executed successfully');
            resolve(result);
          } else {
            console.error('❌ API Error:', result);
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

async function fixForeignKey() {
  console.log('🔧 Fixing foreign key constraint...\n');

  try {
    // 1. Create system user (without team_id to avoid another FK constraint)
    console.log('1️⃣ Creating system user...');
    await executeSql(`
      INSERT OR IGNORE INTO users (
        id, phone, password_hash, name, email, role, is_active, created_at
      ) VALUES (
        'system', 
        '0000000000', 
        'not_used', 
        'System User', 
        'system@example.com', 
        'admin', 
        1, 
        datetime('now')
      )
    `);

    // 2. Create demo user
    console.log('2️⃣ Creating demo user...');
    await executeSql(`
      INSERT OR IGNORE INTO users (
        id, phone, password_hash, name, email, role, is_active, created_at
      ) VALUES (
        'demo_user', 
        '0912345678', 
        'demo123', 
        'Demo User', 
        'demo@example.com', 
        'manager', 
        1, 
        datetime('now')
      )
    `);

    // 3. Verify users exist
    console.log('3️⃣ Verifying users...');
    const result = await executeSql('SELECT id, name, role FROM users');
    console.log('Users in database:', result);

    console.log('\n✅ Foreign key fix completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixForeignKey();