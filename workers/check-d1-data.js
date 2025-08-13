#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkD1Data() {
    const token = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
    
    try {
        console.log('🔍 Checking D1 Database: engineering-management\n');
        
        // Check if projects table exists and has data
        const { stdout: projectCount } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${token}" npx wrangler d1 execute engineering-management --command "SELECT COUNT(*) as count FROM projects;"`
        );
        console.log('Projects table count:', projectCount);
        
        // Get sample project data
        const { stdout: projectData } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${token}" npx wrangler d1 execute engineering-management --command "SELECT id, name, opportunity_id, LENGTH(spc_engineering) as spc_len, LENGTH(cabinet_engineering) as cab_len, LENGTH(permissions) as perm_len, LENGTH(cached_stats) as stats_len, status, created_at FROM projects LIMIT 5;"`
        );
        console.log('\n📊 Sample project data:');
        console.log(projectData);
        
        // Check specific project if exists
        const testId = '650fe201d184e50001102aee';
        const { stdout: specificProject } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${token}" npx wrangler d1 execute engineering-management --command "SELECT * FROM projects WHERE id = '${testId}' OR opportunity_id = '${testId}';"`
        );
        console.log(`\n🔎 Looking for project with ID ${testId}:`);
        console.log(specificProject);
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.stdout) console.log('Output:', error.stdout);
        if (error.stderr) console.log('Error output:', error.stderr);
    }
}

checkD1Data();