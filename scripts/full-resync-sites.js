#!/usr/bin/env node

/**
 * 完整重新同步所有案場資料
 * 使用分頁 API 來確保所有 3277 條資料都被同步
 */

const axios = require('axios');
const fs = require('fs');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

// 創建日誌文件
const logFile = 'full-resync-' + new Date().toISOString().replace(/:/g, '-') + '.log';
const log = (msg) => {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
};

async function fullResyncSites() {
  log('🔄 開始完整重新同步所有案場資料...');
  log(`日誌文件: ${logFile}\n`);

  try {
    // 1. 檢查當前狀態
    log('1. 檢查當前同步狀態...');
    let response = await axios.get(`${WORKER_URL}/api/sync/status`);
    const stats = response.data.data.statistics.find(s => s.entity_type === 'object_8W9cb__c');
    
    if (stats) {
      log(`當前案場同步統計:`);
      log(`  總同步次數: ${stats.sync_count}`);
      log(`  成功次數: ${stats.success_count}`);
      log(`  失敗次數: ${stats.failed_count}`);
      log(`  最後同步: ${new Date(stats.last_sync_time).toLocaleString()}\n`);
    }

    // 2. 使用分頁 API 同步所有資料
    log('2. 開始分頁同步所有案場資料...');
    log('總數: 3277 條');
    log('每批: 500 條');
    log('預計批次: 7 批\n');

    const batchSize = 500;
    const totalCount = 3277;
    let totalSuccess = 0;
    let totalErrors = 0;
    let actualTotal = 0;

    for (let offset = 0; offset < totalCount; offset += batchSize) {
      const batchNum = Math.floor(offset / batchSize) + 1;
      const expectedCount = Math.min(batchSize, totalCount - offset);
      
      log(`批次 ${batchNum}: offset=${offset}, 預期獲取=${expectedCount}`);
      
      try {
        const startTime = Date.now();
        response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/page`, {
          offset: offset,
          limit: batchSize
        }, {
          timeout: 60000 // 60 秒超時
        });
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        if (response.data.success) {
          const result = response.data.data.result;
          totalSuccess += result.success || 0;
          totalErrors += result.errors || 0;
          actualTotal += result.totalFetched || 0;
          
          log(`  ✅ 完成 (${elapsed}秒)`);
          log(`     獲取: ${result.totalFetched || 0} 條`);
          log(`     成功: ${result.success || 0} 條`);
          log(`     失敗: ${result.errors || 0} 條`);
          
          // 如果獲取數量少於預期，說明已經到末尾
          if ((result.totalFetched || 0) < expectedCount) {
            log(`  ℹ️  獲取數量少於預期，已到達資料末尾`);
            break;
          }
        } else {
          log(`  ❌ 批次失敗: ${response.data.error}`);
          totalErrors += expectedCount;
        }
      } catch (error) {
        log(`  ❌ 批次錯誤: ${error.message}`);
        if (error.code === 'ECONNABORTED') {
          log(`     請求超時，可能是資料量太大`);
        }
        totalErrors += expectedCount;
      }
      
      // 短暫延遲，避免過載
      if (offset + batchSize < totalCount) {
        log(`  等待 2 秒...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 3. 同步結果統計
    log('\n\n========== 同步完成 ==========');
    log(`從 CRM 獲取總數: ${actualTotal} 條`);
    log(`成功同步: ${totalSuccess} 條`);
    log(`同步失敗: ${totalErrors} 條`);
    log(`成功率: ${((totalSuccess / actualTotal) * 100).toFixed(1)}%`);

    // 4. 再次檢查同步狀態
    log('\n3. 檢查最終同步狀態...');
    response = await axios.get(`${WORKER_URL}/api/sync/status`);
    const finalStats = response.data.data.statistics.find(s => s.entity_type === 'object_8W9cb__c');
    
    if (finalStats) {
      log(`最終案場同步統計:`);
      log(`  總同步次數: ${finalStats.sync_count}`);
      log(`  成功次數: ${finalStats.success_count}`);
      log(`  失敗次數: ${finalStats.failed_count}`);
    }

    // 5. 建議後續操作
    log('\n\n💡 後續建議:');
    if (actualTotal === 3277 && totalSuccess === 3277) {
      log('✨ 完美！所有 3277 條案場資料都已成功同步！');
    } else if (totalSuccess < actualTotal) {
      log(`⚠️  有 ${actualTotal - totalSuccess} 條資料同步失敗`);
      log('可能原因：');
      log('1. 某些記錄的欄位格式有問題');
      log('2. 資料庫連接超時');
      log('3. 重複的記錄');
      log('\n建議檢查日誌文件了解具體失敗原因');
    }
    
    log('\n使用以下命令檢查 D1 中的實際數量：');
    log('wrangler d1 execute fx-crm-database --remote --command="SELECT COUNT(*) FROM object_8w9cb__c"');
    
    log(`\n完整日誌已保存到: ${logFile}`);

  } catch (error) {
    log(`\n❌ 錯誤: ${error.message}`);
    if (error.response) {
      log(`詳情: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 執行
console.log('⚠️  此操作將同步所有 3277 條案場資料');
console.log('預計需要 5-10 分鐘，取決於網絡狀況\n');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('是否開始？(y/n) ', (answer) => {
  rl.close();
  if (answer.toLowerCase() === 'y') {
    fullResyncSites();
  } else {
    console.log('已取消操作');
  }
});