#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

const API_TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const ACCOUNT_ID = '4178e03ce554bc3867d9211cd225e665';
const DATABASE_ID = '21fce5cd-8364-4dc2-be7f-6d68cbd6fca9';

// Read SQL schema
const schema = fs.readFileSync('./schema-v2.sql', 'utf8');

// Parse SQL statements more carefully
const parseSQL = (sql) => {
  const statements = [];
  const lines = sql.split('\n');
  let currentStatement = '';
  let inComment = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('--') || trimmed === '') continue;
    
    currentStatement += line + '\n';
    
    // Check if statement ends with semicolon
    if (trimmed.endsWith(';')) {
      const cleanStatement = currentStatement.trim();
      if (cleanStatement.length > 0 && !cleanStatement.startsWith('--')) {
        statements.push(cleanStatement);
      }
      currentStatement = '';
    }
  }
  
  return statements;
};

// Execute SQL
const executeSql = (sql) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql });
    
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
  console.log('🚀 Starting Complete D1 Database Initialization...');
  console.log(`📊 Database: engineering-management`);
  console.log(`🔑 Account ID: ${ACCOUNT_ID}`);
  console.log('');

  const statements = parseSQL(schema);
  console.log(`📋 Found ${statements.length} SQL statements`);
  
  // Group statements by type
  const createTables = statements.filter(s => s.toUpperCase().startsWith('CREATE TABLE'));
  const createIndexes = statements.filter(s => s.toUpperCase().startsWith('CREATE INDEX'));
  const inserts = statements.filter(s => s.toUpperCase().startsWith('INSERT'));
  
  console.log(`   - ${createTables.length} CREATE TABLE statements`);
  console.log(`   - ${createIndexes.length} CREATE INDEX statements`);
  console.log(`   - ${inserts.length} INSERT statements`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  // Execute CREATE TABLE statements first
  console.log('📋 Creating tables...');
  for (let i = 0; i < createTables.length; i++) {
    const statement = createTables[i];
    const tableName = statement.match(/CREATE TABLE.*?(\w+)/i)?.[1] || 'unknown';
    
    try {
      process.stdout.write(`   [${i + 1}/${createTables.length}] Creating table ${tableName}... `);
      await executeSql(statement);
      console.log('✅');
      successCount++;
    } catch (error) {
      console.log('❌');
      console.error(`      Error: ${JSON.stringify(error)}`);
      errorCount++;
    }
  }

  // Execute CREATE INDEX statements
  console.log('\n📋 Creating indexes...');
  for (let i = 0; i < createIndexes.length; i++) {
    const statement = createIndexes[i];
    const indexName = statement.match(/CREATE INDEX\s+(\w+)/i)?.[1] || 'unknown';
    
    try {
      process.stdout.write(`   [${i + 1}/${createIndexes.length}] Creating index ${indexName}... `);
      await executeSql(statement);
      console.log('✅');
      successCount++;
    } catch (error) {
      console.log('❌');
      // Indexes might fail if tables don't exist, which is ok
      errorCount++;
    }
  }

  // Execute INSERT statements
  console.log('\n📋 Inserting initial data...');
  for (let i = 0; i < inserts.length; i++) {
    const statement = inserts[i];
    const tableName = statement.match(/INSERT.*?INTO\s+(\w+)/i)?.[1] || 'unknown';
    
    try {
      process.stdout.write(`   [${i + 1}/${inserts.length}] Inserting into ${tableName}... `);
      await executeSql(statement);
      console.log('✅');
      successCount++;
    } catch (error) {
      console.log('❌');
      console.error(`      Error: ${JSON.stringify(error)}`);
      errorCount++;
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
    // Test 1: Check tables
    const tablesResult = await executeSql(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    console.log('✅ Tables created:', tablesResult.result?.[0]?.results?.length || 0);
    
    if (tablesResult.result?.[0]?.results) {
      console.log('   Tables:');
      tablesResult.result[0].results.forEach(table => {
        console.log(`     - ${table.name}`);
      });
    }
    
    // Test 2: Check engineering types
    try {
      const typesResult = await executeSql('SELECT * FROM engineering_types');
      console.log('✅ Engineering types:', typesResult.result?.[0]?.results?.length || 0);
      
      if (typesResult.result?.[0]?.results) {
        typesResult.result[0].results.forEach(type => {
          console.log(`     - ${type.icon} ${type.name} (${type.code})`);
        });
      }
    } catch (e) {
      console.log('⚠️  Engineering types table not ready yet');
    }
    
  } catch (error) {
    console.log('❌ Database test failed:', error);
  }
})();