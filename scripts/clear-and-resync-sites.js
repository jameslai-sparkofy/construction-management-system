#!/usr/bin/env node

/**
 * 清空案場資料並重新同步
 * 使用 Cloudflare Workers 的 API 來執行
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function clearAndResyncSites() {
  console.log('🔄 清空案場資料並重新同步...\n');

  try {
    // 1. 檢查當前狀態
    console.log('1. 檢查當前狀態...');
    let response = await axios.get(`${WORKER_URL}/api/sync/status`);
    const stats = response.data.data.statistics.find(s => s.entity_type === 'object_8W9cb__c');
    
    if (stats) {
      console.log(`當前案場同步統計:`);
      console.log(`  總同步次數: ${stats.sync_count}`);
      console.log(`  最後同步: ${new Date(stats.last_sync_time).toLocaleString()}`);
    }

    // 2. 使用管理員介面的 API（如果有的話）檢查當前數量
    console.log('\n2. 檢查當前案場數量...');
    try {
      response = await axios.get(`${WORKER_URL}/api/health`);
      console.log('健康檢查:', response.data);
    } catch (e) {
      console.log('無法獲取當前數量');
    }

    // 3. 觸發多次同步（每次最多 500 條）
    console.log('\n3. 開始分批同步所有案場資料...');
    console.log('由於 Worker 限制，每次最多同步 500 條');
    console.log('總共需要同步 3277 條，預計需要 7 批次\n');

    let totalSynced = 0;
    let batchCount = 0;
    let consecutiveZeros = 0;

    while (totalSynced < 3277 && batchCount < 10) {
      batchCount++;
      console.log(`\n批次 ${batchCount}:`);
      
      // 觸發同步
      try {
        response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/start`);
        
        if (response.data.success) {
          const result = response.data.data.result;
          console.log(`  成功: ${result.success || 0} 條`);
          console.log(`  失敗: ${result.errors || 0} 條`);
          
          const syncedInBatch = (result.success || 0);
          totalSynced += syncedInBatch;
          
          // 如果連續兩次都是 0，可能已經同步完成
          if (syncedInBatch === 0) {
            consecutiveZeros++;
            if (consecutiveZeros >= 2) {
              console.log('\n已連續兩次沒有新資料，同步可能已完成');
              break;
            }
          } else {
            consecutiveZeros = 0;
          }
        } else {
          console.log('  同步請求失敗:', response.data.error);
        }
      } catch (error) {
        console.log('  同步錯誤:', error.message);
      }
      
      // 等待 30 秒再進行下一批
      if (batchCount < 10 && totalSynced < 3277) {
        console.log('  等待 30 秒...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    // 4. 檢查最終結果
    console.log('\n\n4. 檢查最終結果...');
    response = await axios.get(`${WORKER_URL}/api/sync/status`);
    const finalStats = response.data.data.statistics.find(s => s.entity_type === 'object_8W9cb__c');
    
    if (finalStats) {
      console.log(`最終案場同步統計:`);
      console.log(`  總同步次數: ${finalStats.sync_count}`);
      console.log(`  成功次數: ${finalStats.success_count}`);
      console.log(`  最後同步: ${new Date(finalStats.last_sync_time).toLocaleString()}`);
    }

    console.log('\n========== 同步完成 ==========');
    console.log(`預計同步數量: ${totalSynced} 條`);
    console.log('\n請注意：');
    console.log('1. 由於是增量同步，實際數量可能需要通過 D1 REST API 確認');
    console.log('2. 如果數量仍不足 3277，可能需要：');
    console.log('   - 清空 D1 中的 sync_logs 表的案場記錄');
    console.log('   - 或在 CRM 中更新那些缺失的記錄');
    console.log('\n建議使用以下命令檢查實際數量：');
    console.log('wrangler d1 execute fx-crm-database --remote --command="SELECT COUNT(*) FROM object_8w9cb__c"');

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    if (error.response) {
      console.error('詳情:', error.response.data);
    }
  }
}

// 提示用戶
console.log('⚠️  注意：此操作將觸發多次同步，可能需要幾分鐘時間');
console.log('由於無法直接清空資料表，我們將依賴增量同步機制');
console.log('如果要完全清空重來，需要：');
console.log('1. 使用 wrangler d1 execute 命令直接清空表');
console.log('2. 或修改 Worker 代碼添加清空功能\n');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('是否繼續？(y/n) ', (answer) => {
  rl.close();
  if (answer.toLowerCase() === 'y') {
    clearAndResyncSites();
  } else {
    console.log('已取消操作');
  }
});