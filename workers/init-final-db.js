#!/usr/bin/env node

/**
 * 初始化最終版本的 D1 資料庫
 */

const { exec } = require('child_process');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const DB_NAME = 'engineering-management';

async function initDatabase() {
    console.log('🚀 開始初始化資料庫...\n');
    
    try {
        // 1. 讀取 SQL 檔案
        const sqlContent = fs.readFileSync('./schema-final.sql', 'utf8');
        console.log('✅ 讀取 schema-final.sql 成功');
        
        // 2. 分割 SQL 語句（處理觸發器等複雜語句）
        const statements = sqlContent
            .split(/;\s*$/gm)
            .filter(stmt => stmt.trim())
            .map(stmt => stmt.trim() + ';');
        
        console.log(`📝 準備執行 ${statements.length} 個 SQL 語句\n`);
        
        // 3. 執行每個語句
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            const shortStmt = stmt.substring(0, 50).replace(/\n/g, ' ');
            
            try {
                // 跳過註解
                if (stmt.trim().startsWith('--')) {
                    continue;
                }
                
                console.log(`[${i + 1}/${statements.length}] 執行: ${shortStmt}...`);
                
                // 使用 wrangler d1 執行 SQL
                const command = `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "${stmt.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
                
                await execPromise(command);
                successCount++;
                console.log(`  ✅ 成功\n`);
                
            } catch (error) {
                errorCount++;
                console.error(`  ❌ 錯誤: ${error.message}\n`);
                
                // 如果是關鍵錯誤，停止執行
                if (stmt.includes('CREATE TABLE') && !stmt.includes('IF NOT EXISTS')) {
                    console.error('⚠️  建立表格失敗，停止執行');
                    break;
                }
            }
        }
        
        // 4. 顯示結果
        console.log('\n' + '='.repeat(60));
        console.log('📊 執行結果：');
        console.log(`  ✅ 成功: ${successCount} 個語句`);
        console.log(`  ❌ 失敗: ${errorCount} 個語句`);
        
        // 5. 驗證表格是否建立成功
        console.log('\n🔍 驗證表格...');
        const { stdout: tables } = await execPromise(
            `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`
        );
        
        console.log('📋 已建立的表格：');
        console.log(tables);
        
        // 6. 插入測試管理員
        console.log('\n👤 建立測試管理員...');
        await execPromise(
            `CLOUDFLARE_API_TOKEN="${TOKEN}" npx wrangler d1 execute ${DB_NAME} --command "INSERT OR REPLACE INTO users (id, phone, password_suffix, name, global_role, source_type) VALUES ('admin_1', '0900000000', '000', '系統管理員', 'admin', 'system');"`
        );
        console.log('✅ 測試管理員建立成功');
        
        console.log('\n✨ 資料庫初始化完成！');
        
    } catch (error) {
        console.error('\n❌ 初始化失敗:', error.message);
        process.exit(1);
    }
}

// 執行初始化
initDatabase();