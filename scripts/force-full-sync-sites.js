#!/usr/bin/env node

/**
 * 強制完整同步案場資料
 * 通過清除最後同步時間來實現
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function forceFullSyncSites() {
  console.log('🔄 強制完整同步案場資料...\n');

  try {
    // 1. 查看當前狀態
    console.log('1. 檢查當前狀態...');
    let response = await axios.get(`${WORKER_URL}/api/sync/status`);
    const stats = response.data.data.statistics.find(s => s.entity_type === 'object_8W9cb__c');
    
    if (stats) {
      console.log(`當前案場同步統計:`);
      console.log(`  總同步次數: ${stats.sync_count}`);
      console.log(`  最後同步: ${new Date(stats.last_sync_time).toLocaleString()}`);
    }

    // 2. 使用 syncSitesByPage 分批同步所有資料
    console.log('\n2. 開始分批同步...');
    const batchSize = 500;
    const totalCount = 3277;
    const totalBatches = Math.ceil(totalCount / batchSize);
    
    let totalSuccess = 0;
    let totalErrors = 0;

    for (let batch = 0; batch < totalBatches; batch++) {
      const offset = batch * batchSize;
      console.log(`\n批次 ${batch + 1}/${totalBatches} (offset: ${offset})...`);
      
      try {
        // 直接調用分頁同步
        response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/sync-by-page`, {
          offset: offset,
          limit: batchSize
        });
        
        if (response.data.success) {
          const result = response.data.data.result;
          totalSuccess += result.success || 0;
          totalErrors += result.errors || 0;
          console.log(`  ✅ 成功: ${result.success}, 失敗: ${result.errors}`);
        }
      } catch (error) {
        console.log(`  ❌ 批次失敗: ${error.message}`);
        
        // 嘗試使用標準同步 API
        try {
          console.log('  嘗試使用標準同步 API...');
          response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/start`, {
            fullSync: true
          });
          
          if (response.data.success) {
            console.log(`  ✅ 標準同步: ${JSON.stringify(response.data.data.result)}`);
            break; // 如果標準同步成功，就不需要繼續分批了
          }
        } catch (e) {
          console.log(`  ❌ 標準同步也失敗: ${e.message}`);
        }
      }
      
      // 短暫延遲
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. 檢查最終結果
    console.log('\n3. 檢查最終結果...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待同步完成
    
    // 使用 REST API 檢查數量
    const countResponse = await axios.get(
      'https://fx-d1-rest-api.lai-jameslai.workers.dev/rest/object_8w9cb__c?limit=1',
      {
        headers: {
          'Authorization': 'Bearer fx-crm-api-secret-2025'
        }
      }
    );
    
    if (countResponse.data.total !== undefined) {
      console.log('\n📊 最終統計:');
      console.log(`  CRM 總數: 3277 條`);
      console.log(`  D1 實際: ${countResponse.data.total} 條`);
      console.log(`  同步率: ${((countResponse.data.total / 3277) * 100).toFixed(1)}%`);
      
      if (countResponse.data.total === 3277) {
        console.log('\n✨ 完美！所有案場資料都已成功同步！');
      } else {
        console.log(`\n⚠️  還有 ${3277 - countResponse.data.total} 條記錄未成功同步`);
      }
    }

  } catch (error) {
    console.error('錯誤:', error.message);
    if (error.response) {
      console.error('詳情:', error.response.data);
    }
  }
}

// 執行
forceFullSyncSites();