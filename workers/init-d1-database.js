#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

const API_TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const ACCOUNT_ID = '4178e03ce554bc3867d9211cd225e665'; // Correct account ID
const DATABASE_ID = '21fce5cd-8364-4dc2-be7f-6d68cbd6fca9'; // engineering-management database

// Read SQL schema
const schema = fs.readFileSync('./schema-v2.sql', 'utf8');

// Split SQL into individual statements
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`📋 Found ${statements.length} SQL statements to execute`);

// Execute SQL statement
const executeSql = (sql) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql: sql + ';' });
    
    const options = {
      hostname: 'api.cloudflare.com',
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
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success) {
            resolve(response);
          } else {
            reject(response.errors || response.messages || 'Unknown error');
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// Main execution
(async () => {
  console.log('🚀 Starting D1 database initialization for engineering-management...');
  console.log(`📊 Database ID: ${DATABASE_ID}`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 50).replace(/\n/g, ' ');
    
    try {
      process.stdout.write(`[${i + 1}/${statements.length}] Executing: ${preview}... `);
      await executeSql(statement);
      console.log('✅');
      successCount++;
    } catch (error) {
      console.log('❌');
      console.error(`   Error: ${JSON.stringify(error)}`);
      errorCount++;
      
      // Continue with next statement even if one fails
      // Some statements like INSERT OR IGNORE might fail if data already exists
    }
  }

  console.log('');
  console.log('========================================');
  console.log(`✨ Database initialization complete!`);
  console.log(`   ✅ Success: ${successCount} statements`);
  console.log(`   ❌ Failed: ${errorCount} statements`);
  console.log('========================================');

  // Test the database
  console.log('');
  console.log('🔍 Testing database...');
  
  try {
    // Test query - get engineering types
    const testResult = await executeSql('SELECT * FROM engineering_types LIMIT 5');
    console.log('✅ Database is working!');
    console.log('   Engineering types found:', testResult.result?.[0]?.results?.length || 0);
    
    // Show the engineering types
    if (testResult.result?.[0]?.results) {
      console.log('   Available types:');
      testResult.result[0].results.forEach(type => {
        console.log(`     - ${type.icon} ${type.name} (${type.code})`);
      });
    }
    
  } catch (error) {
    console.log('❌ Database test failed:', error);
  }
})();