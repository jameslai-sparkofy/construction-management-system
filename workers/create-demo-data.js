#!/usr/bin/env node

/**
 * 直接在 D1 建立興安西測試資料
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const DB_NAME = 'engineering-management';

async function createDemoData() {
    console.log('🚀 建立興安西測試資料...\n');
    
    try {
        const projectId = '650fe201d184e50001102aee';
        
        // 1. 建立專案
        console.log('📁 建立專案...');
        await execPromise(
            `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO projects (id, opportunity_id, name, spc_engineering, cabinet_engineering, permissions, status, created_by) VALUES ('${projectId}', '${projectId}', '興安西', '{\\\"enabled\\\":true,\\\"types\\\":[\\\"SPC地板\\\",\\\"塑膠地板\\\",\\\"SPC牆板\\\"],\\\"sites\\\":[]}', '{\\\"enabled\\\":true,\\\"types\\\":[\\\"浴櫃\\\"],\\\"sites\\\":[]}', '{\\\"owners\\\":[],\\\"fieldPermissions\\\":{\\\"ownerPhone\\\":{\\\"view\\\":true,\\\"edit\\\":false},\\\"ownerName\\\":{\\\"view\\\":true,\\\"edit\\\":false},\\\"constructionDate\\\":{\\\"view\\\":true,\\\"edit\\\":true},\\\"notes\\\":{\\\"view\\\":true,\\\"edit\\\":true}},\\\"crossViewEnabled\\\":false}', 'active', 'system');"`
        );
        console.log('✅ 專案建立成功');
        
        // 2. 建立工班
        console.log('\n👷 建立工班...');
        const teams = [
            { id: 'team_1', name: '陳師傅團隊', leaderName: '陳建國', leaderPhone: '0912345678' },
            { id: 'team_2', name: '林師傅團隊', leaderName: '林志明', leaderPhone: '0923456789' },
            { id: 'team_3', name: '王師傅團隊', leaderName: '王大明', leaderPhone: '0934567890' }
        ];
        
        for (const team of teams) {
            // 建立工班分配
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO project_team_assignments (project_id, team_id, team_name, leader_name, leader_phone, status) VALUES ('${projectId}', '${team.id}', '${team.name}', '${team.leaderName}', '${team.leaderPhone}', 'active');"`
            );
            
            // 建立團隊主檔
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO teams (id, name, is_active) VALUES ('${team.id}', '${team.name}', 1);"`
            );
            
            // 建立工班長使用者
            const leaderId = `user_${team.id}_leader`;
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO users (id, phone, password_suffix, name, global_role, source_type) VALUES ('${leaderId}', '${team.leaderPhone}', '${team.leaderPhone.slice(-3)}', '${team.leaderName}', 'worker', 'crm_worker');"`
            );
            
            // 加入專案成員
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO project_members (project_id, user_id, member_type, team_id, role) VALUES ('${projectId}', '${leaderId}', 'team', '${team.id}', 'leader');"`
            );
            
            console.log(`✅ 工班 ${team.name} 建立成功`);
            
            // 建立工班成員
            for (let i = 1; i <= 2; i++) {
                const memberId = `user_${team.id}_member_${i}`;
                const memberName = `${team.name.charAt(0)}工人${i}`;
                const memberPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
                
                await execPromise(
                    `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO users (id, phone, password_suffix, name, global_role, source_type) VALUES ('${memberId}', '${memberPhone}', '${memberPhone.slice(-3)}', '${memberName}', 'worker', 'crm_worker');"`
                );
                
                await execPromise(
                    `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO project_members (project_id, user_id, member_type, team_id, role) VALUES ('${projectId}', '${memberId}', 'team', '${team.id}', 'member');"`
                );
            }
        }
        
        // 3. 建立業主
        console.log('\n🏠 建立業主...');
        const owners = [
            { id: 'owner_1', name: '張美玲', phone: '0945678901' },
            { id: 'owner_2', name: '李文華', phone: '0956789012' },
            { id: 'owner_3', name: '黃秀英', phone: '0967890123' }
        ];
        
        for (const owner of owners) {
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO users (id, phone, password_suffix, name, global_role, source_type) VALUES ('${owner.id}', '${owner.phone}', '${owner.phone.slice(-3)}', '${owner.name}', 'owner', 'crm_contact');"`
            );
            
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO project_members (project_id, user_id, member_type, role) VALUES ('${projectId}', '${owner.id}', 'owner', 'viewer');"`
            );
            
            console.log(`✅ 業主 ${owner.name} 建立成功`);
        }
        
        // 4. 建立範例施工進度
        console.log('\n🏗️ 建立施工進度範例...');
        const sites = [
            { id: 'site_1', teamId: 'team_1', status: 'completed', area: 35.5 },
            { id: 'site_2', teamId: 'team_1', status: 'in_progress', area: 42.0 },
            { id: 'site_3', teamId: 'team_2', status: 'pending', area: 28.3 }
        ];
        
        for (const site of sites) {
            await execPromise(
                `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT INTO construction_progress (project_id, site_id, team_id, status, construction_area, notes) VALUES ('${projectId}', '${site.id}', '${site.teamId}', '${site.status}', ${site.area}, '施工進度正常');"`
            );
        }
        console.log('✅ 施工進度建立成功');
        
        // 5. 驗證資料
        console.log('\n🔍 驗證資料...');
        
        // 檢查專案
        const { stdout: projectCheck } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "SELECT id, name, status FROM projects WHERE id = '${projectId}';"`
        );
        console.log('專案資料:', projectCheck);
        
        // 檢查成員數量
        const { stdout: memberCount } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "SELECT member_type, COUNT(*) as count FROM project_members WHERE project_id = '${projectId}' GROUP BY member_type;"`
        );
        console.log('\n成員統計:', memberCount);
        
        // 檢查工班
        const { stdout: teamCheck } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "SELECT team_id, team_name, status FROM project_team_assignments WHERE project_id = '${projectId}';"`
        );
        console.log('\n工班資料:', teamCheck);
        
        console.log('\n✨ 興安西測試資料建立完成！');
        console.log('\n📝 測試帳號：');
        console.log('  管理員: 0900000000 / 000');
        console.log('  工班長: 0912345678 / 678 (陳建國)');
        console.log('  業主: 0945678901 / 901 (張美玲)');
        
    } catch (error) {
        console.error('\n❌ 建立失敗:', error.message);
        if (error.stdout) console.log('Output:', error.stdout);
        if (error.stderr) console.log('Error:', error.stderr);
        process.exit(1);
    }
}

// 執行建立
createDemoData();