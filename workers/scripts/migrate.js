#!/usr/bin/env node

/**
 * Database Migration Script
 * Run migrations for the engineering management database
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const DB_NAME = 'engineering-management';
const MIGRATION_TABLE = 'schema_migrations';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Create migration tracking table
function createMigrationTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    execSync(`wrangler d1 execute ${DB_NAME} --command="${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      stdio: 'inherit'
    });
    logSuccess('Migration table ready');
  } catch (error) {
    logError('Failed to create migration table');
    throw error;
  }
}

// Get list of executed migrations
function getExecutedMigrations() {
  try {
    const result = execSync(
      `wrangler d1 execute ${DB_NAME} --command="SELECT version FROM ${MIGRATION_TABLE} ORDER BY version"`,
      { encoding: 'utf-8' }
    );
    
    // Parse the output to extract version numbers
    const versions = [];
    const lines = result.split('\n');
    let inResults = false;
    
    for (const line of lines) {
      if (line.includes('─────')) {
        inResults = !inResults;
        continue;
      }
      if (inResults && line.trim()) {
        const version = line.split('│')[1]?.trim();
        if (version) {
          versions.push(version);
        }
      }
    }
    
    return versions;
  } catch (error) {
    // Table might not exist yet
    return [];
  }
}

// Get list of migration files
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    logWarning('Created migrations directory');
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  return files.map(file => ({
    file,
    version: file.split('_')[0],
    name: file.replace('.sql', '')
  }));
}

// Execute a migration file
function executeMigration(migration) {
  const filePath = path.join(MIGRATIONS_DIR, migration.file);
  
  logInfo(`Executing migration: ${migration.name}`);
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    // Split by semicolon to handle multiple statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.includes('--') && !statement.includes('CREATE')) {
        // Skip comment-only lines
        continue;
      }
      
      const cleanStatement = statement.replace(/\n/g, ' ').replace(/"/g, '\\"');
      execSync(`wrangler d1 execute ${DB_NAME} --command="${cleanStatement}"`, {
        stdio: 'pipe'
      });
    }
    
    // Record the migration
    const recordSql = `INSERT INTO ${MIGRATION_TABLE} (version, name) VALUES ('${migration.version}', '${migration.name}')`;
    execSync(`wrangler d1 execute ${DB_NAME} --command="${recordSql}"`, {
      stdio: 'pipe'
    });
    
    logSuccess(`Migration completed: ${migration.name}`);
    return true;
  } catch (error) {
    logError(`Migration failed: ${migration.name}`);
    console.error(error.message);
    return false;
  }
}

// Rollback a migration
function rollbackMigration(version) {
  logInfo(`Rolling back migration: ${version}`);
  
  try {
    // Check for rollback file
    const rollbackFile = path.join(MIGRATIONS_DIR, `${version}_rollback.sql`);
    
    if (fs.existsSync(rollbackFile)) {
      const sql = fs.readFileSync(rollbackFile, 'utf-8');
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        const cleanStatement = statement.replace(/\n/g, ' ').replace(/"/g, '\\"');
        execSync(`wrangler d1 execute ${DB_NAME} --command="${cleanStatement}"`, {
          stdio: 'pipe'
        });
      }
    } else {
      logWarning(`No rollback file found for version ${version}`);
    }
    
    // Remove from migration table
    const deleteSql = `DELETE FROM ${MIGRATION_TABLE} WHERE version = '${version}'`;
    execSync(`wrangler d1 execute ${DB_NAME} --command="${deleteSql}"`, {
      stdio: 'pipe'
    });
    
    logSuccess(`Rollback completed: ${version}`);
    return true;
  } catch (error) {
    logError(`Rollback failed: ${version}`);
    console.error(error.message);
    return false;
  }
}

// Main migration runner
async function runMigrations(command = 'up') {
  log(`\n🗄️  Database Migration Tool`, colors.bright);
  log(`Database: ${DB_NAME}\n`);

  try {
    // Create migration table if it doesn't exist
    createMigrationTable();

    // Get executed and pending migrations
    const executed = getExecutedMigrations();
    const migrations = getMigrationFiles();
    
    if (command === 'status') {
      // Show migration status
      log('\n📊 Migration Status:', colors.bright);
      
      if (migrations.length === 0) {
        logWarning('No migration files found');
        return;
      }
      
      for (const migration of migrations) {
        const isExecuted = executed.includes(migration.version);
        if (isExecuted) {
          log(`  ✅ ${migration.name}`, colors.green);
        } else {
          log(`  ⏳ ${migration.name}`, colors.yellow);
        }
      }
      
      log(`\nTotal: ${migrations.length} migrations, ${executed.length} executed`);
      return;
    }
    
    if (command === 'up' || command === 'migrate') {
      // Run pending migrations
      const pending = migrations.filter(m => !executed.includes(m.version));
      
      if (pending.length === 0) {
        logSuccess('All migrations are up to date');
        return;
      }
      
      log(`Found ${pending.length} pending migration(s)\n`);
      
      for (const migration of pending) {
        const success = executeMigration(migration);
        if (!success) {
          logError('Migration failed, stopping');
          process.exit(1);
        }
      }
      
      logSuccess(`\n✨ All migrations completed successfully`);
    }
    
    if (command === 'down' || command === 'rollback') {
      // Rollback last migration
      if (executed.length === 0) {
        logWarning('No migrations to rollback');
        return;
      }
      
      const lastVersion = executed[executed.length - 1];
      rollbackMigration(lastVersion);
    }
    
    if (command === 'reset') {
      // Rollback all migrations
      log('⚠️  Resetting all migrations...', colors.yellow);
      
      for (let i = executed.length - 1; i >= 0; i--) {
        rollbackMigration(executed[i]);
      }
      
      logSuccess('Database reset complete');
    }
    
  } catch (error) {
    logError('Migration failed');
    console.error(error);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2] || 'up';
const validCommands = ['up', 'migrate', 'down', 'rollback', 'status', 'reset'];

if (!validCommands.includes(command)) {
  log('Usage: node migrate.js [command]');
  log('Commands:');
  log('  up, migrate  - Run pending migrations');
  log('  down, rollback - Rollback last migration');
  log('  status       - Show migration status');
  log('  reset        - Rollback all migrations');
  process.exit(1);
}

// Run migrations
runMigrations(command);