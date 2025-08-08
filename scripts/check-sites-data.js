#!/usr/bin/env node

/**
 * 檢查案場數據
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function checkSitesData() {
  console.log('📊 檢查案場數據...\n');

  try {
    // 獲取 D1 統計
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    const { tables } = statsResponse.data.data;
    
    console.log(`案場數據統計：`);
    console.log(`   總數: ${tables.sites} 條`);
    console.log(`   商機: ${tables.opportunities} 條`);
    console.log(`   同步日誌: ${tables.syncLogs} 條`);
    
    // 獲取同步狀態
    const statusResponse = await axios.get(`${WORKER_URL}/api/sync/status`);
    const { recentSyncs, statistics } = statusResponse.data.data;
    
    console.log('\n最近的案場同步記錄：');
    const siteSyncs = recentSyncs.filter(sync => sync.entity_type === 'object_8W9cb__c').slice(0, 5);
    
    siteSyncs.forEach(sync => {
      const time = new Date(sync.created_at).toLocaleString();
      console.log(`\n${time} - ${sync.status}`);
      console.log(`   記錄數: ${sync.records_count}`);
      console.log(`   錯誤數: ${sync.error_count}`);
      
      if (sync.details) {
        try {
          const details = JSON.parse(sync.details);
          if (details.error) {
            console.log(`   錯誤: ${details.error}`);
          }
        } catch (e) {
          // 忽略解析錯誤
        }
      }
    });
    
    // 統計信息
    const siteStats = statistics.find(s => s.entity_type === 'object_8W9cb__c');
    if (siteStats) {
      console.log('\n案場同步統計：');
      console.log(`   總同步次數: ${siteStats.sync_count}`);
      console.log(`   成功次數: ${siteStats.success_count}`);
      console.log(`   失敗次數: ${siteStats.failed_count}`);
      console.log(`   最後同步: ${new Date(siteStats.last_sync_time).toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('檢查失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

checkSitesData();