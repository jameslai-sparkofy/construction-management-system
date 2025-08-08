#!/usr/bin/env node

/**
 * 檢查並顯示部署資訊
 */

const { execSync } = require('child_process');

console.log('🔍 檢查 Cloudflare Workers 部署資訊...\n');

try {
  // 獲取帳戶資訊
  const accountInfo = execSync('wrangler whoami', { 
    cwd: '../workers',
    encoding: 'utf8' 
  });
  
  console.log('📧 登入帳戶:');
  const emailMatch = accountInfo.match(/email\s+([^\s]+)/);
  if (emailMatch) {
    console.log(`   ${emailMatch[1]}`);
  }
  
  // 從 wrangler.toml 獲取 worker 名稱
  const fs = require('fs');
  const tomlContent = fs.readFileSync('../workers/wrangler.toml', 'utf8');
  const nameMatch = tomlContent.match(/name\s*=\s*"([^"]+)"/);
  
  if (nameMatch) {
    const workerName = nameMatch[1];
    console.log(`\n🚀 Worker 名稱: ${workerName}`);
    
    // 從帳戶資訊中提取 Account ID - 使用更寬鬆的正則
    const lines = accountInfo.split('\n');
    let accountId = null;
    
    for (const line of lines) {
      // 尋找包含 32 位十六進位字串的行
      const match = line.match(/([a-f0-9]{32})/i);
      if (match) {
        accountId = match[1];
        break;
      }
    }
    
    if (accountId) {
      
      console.log('\n📌 部署 URL:');
      console.log(`   開發環境: https://${workerName}.${accountId.substring(0, 8)}.workers.dev`);
      console.log(`   生產環境: https://${workerName}.workers.dev`);
      
      console.log('\n🔗 管理介面:');
      console.log(`   Cloudflare Dashboard: https://dash.cloudflare.com/${accountId}/workers/services/view/${workerName}`);
      console.log(`   D1 資料庫: https://dash.cloudflare.com/${accountId}/workers/d1`);
      console.log(`   KV 儲存: https://dash.cloudflare.com/${accountId}/workers/kv/namespaces`);
      console.log(`   R2 儲存: https://dash.cloudflare.com/${accountId}/r2/buckets`);
    }
  }
  
  console.log('\n📊 API 端點:');
  console.log('   健康檢查: /api/health');
  console.log('   手動同步: /api/sync/{objectApiName}/start');
  console.log('   同步狀態: /api/sync/status');
  console.log('   資料查詢: /api/data/{objectApiName}');
  
  console.log('\n🛠️ 常用命令:');
  console.log('   部署: cd workers && wrangler deploy');
  console.log('   日誌: cd workers && wrangler tail');
  console.log('   本地開發: cd workers && wrangler dev');
  
} catch (error) {
  console.error('❌ 錯誤:', error.message);
  console.log('\n請確保已登入 Cloudflare:');
  console.log('   wrangler login');
}