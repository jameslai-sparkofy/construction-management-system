#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting forced deployment...');

// Read the Worker code
const workerCode = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');

// Check if it has the new endpoints
if (workerCode.includes('/api/v1/workers')) {
  console.log('✓ Worker code contains /api/v1/workers endpoint');
} else {
  console.error('✗ Worker code missing /api/v1/workers endpoint');
  process.exit(1);
}

if (workerCode.includes('/api/v1/opportunity-contacts/')) {
  console.log('✓ Worker code contains /api/v1/opportunity-contacts endpoint');
} else {
  console.error('✗ Worker code missing /api/v1/opportunity-contacts endpoint');
  process.exit(1);
}

// Deploy
console.log('Deploying to Cloudflare Workers...');
exec('npx wrangler deploy --name construction-management-api', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  console.log(`stdout: ${stdout}`);
  console.log('Deployment command executed');
});