#!/usr/bin/env node

/**
 * 測試生產環境同步功能
 */

const axios = require('axios');

const PROD_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev/api';

async function testProductionSync() {
  console.log('🚀 開始測試生產環境同步功能\n');
  console.log('Worker URL:', PROD_URL);
  console.log('批次大小: 500 條/批\n');

  try {
    // 1. 測試健康檢查
    console.log('📊 Step 1: 健康檢查...');
    const healthResponse = await axios.get(`${PROD_URL.replace('/api', '')}/api/health`);
    console.log('✅ Worker 運行正常');
    console.log(`   時間: ${healthResponse.data.timestamp}\n`);

    // 2. 測試商機同步
    console.log('📊 Step 2: 同步商機數據...');
    console.log('⏳ 正在從紛享銷客獲取商機數據，請稍候...');
    
    const oppStartTime = Date.now();
    try {
      const oppResponse = await axios.post(`${PROD_URL}/sync/NewOpportunityObj/start`, {}, {
        timeout: 300000 // 5分鐘超時
      });
      const oppDuration = (Date.now() - oppStartTime) / 1000;
      
      if (oppResponse.data.success) {
        console.log(`✅ 商機同步完成 (耗時: ${oppDuration.toFixed(2)}秒)`);
        const result = oppResponse.data.data.result;
        console.log(`   成功: ${result.success} 條`);
        console.log(`   失敗: ${result.errors} 條`);
        console.log(`   同步ID: ${oppResponse.data.data.syncId || 'N/A'}\n`);
      }
    } catch (error) {
      console.error(`❌ 商機同步失敗: ${error.response?.data?.error || error.message}`);
      if (error.code === 'ECONNABORTED') {
        console.log('   提示: 同步可能需要較長時間，請檢查 Worker 日誌');
      }
    }

    // 3. 測試案場同步
    console.log('📊 Step 3: 同步案場數據...');
    console.log('⏳ 正在從紛享銷客獲取案場數據（約3000+條），請耐心等待...');
    
    const siteStartTime = Date.now();
    try {
      const siteResponse = await axios.post(`${PROD_URL}/sync/object_8W9cb__c/start`, {}, {
        timeout: 600000 // 10分鐘超時
      });
      const siteDuration = (Date.now() - siteStartTime) / 1000;
      
      if (siteResponse.data.success) {
        console.log(`✅ 案場同步完成 (耗時: ${siteDuration.toFixed(2)}秒)`);
        const result = siteResponse.data.data.result;
        console.log(`   成功: ${result.success} 條`);
        console.log(`   失敗: ${result.errors} 條`);
        console.log(`   同步ID: ${siteResponse.data.data.syncId || 'N/A'}\n`);
      }
    } catch (error) {
      console.error(`❌ 案場同步失敗: ${error.response?.data?.error || error.message}`);
      if (error.code === 'ECONNABORTED') {
        console.log('   提示: 案場數據較多，同步可能需要較長時間');
      }
    }

    // 4. 查看同步狀態
    console.log('📈 Step 4: 查看同步統計...');
    const statusResponse = await axios.get(`${PROD_URL}/sync/status`);
    
    if (statusResponse.data.success) {
      const { recentSyncs, statistics } = statusResponse.data.data;
      
      if (recentSyncs.length > 0) {
        console.log('\n最近同步記錄:');
        recentSyncs.slice(0, 5).forEach(sync => {
          const time = new Date(sync.created_at).toLocaleString('zh-TW');
          console.log(`   ${sync.entity_type}: ${sync.status} - ${time}`);
          console.log(`     記錄數: ${sync.records_count}, 錯誤: ${sync.error_count}`);
        });
      }
      
      if (statistics.length > 0) {
        console.log('\n同步統計總覽:');
        statistics.forEach(stat => {
          console.log(`   ${stat.entity_type}:`);
          console.log(`     總次數: ${stat.sync_count}`);
          console.log(`     成功: ${stat.success_count}`);
          console.log(`     失敗: ${stat.failed_count}`);
          if (stat.last_sync_time) {
            console.log(`     最後同步: ${new Date(stat.last_sync_time).toLocaleString('zh-TW')}`);
          }
        });
      }
    }

    console.log('\n🎉 測試完成！');
    console.log('\n💡 提示：');
    console.log('- Worker URL: https://fx-crm-sync.lai-jameslai.workers.dev');
    console.log('- 定時同步已啟用：每小時自動執行一次');
    console.log('- 可以通過 wrangler tail 查看實時日誌');
    console.log('- D1 資料庫可通過 Cloudflare Dashboard 查看');

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

// 執行測試
testProductionSync();