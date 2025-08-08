#!/usr/bin/env node

/**
 * 檢查同步錯誤
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function checkSyncErrors() {
  console.log('🔍 檢查同步錯誤...\n');

  try {
    // 獲取同步狀態
    const response = await axios.get(`${WORKER_URL}/api/sync/status`);
    const { recentSyncs } = response.data.data;

    // 找出有錯誤的同步記錄
    const errorSyncs = recentSyncs.filter(sync => 
      sync.error_count > 0 || sync.status === 'FAILED'
    );

    if (errorSyncs.length === 0) {
      console.log('✅ 沒有發現錯誤記錄');
      return;
    }

    console.log(`發現 ${errorSyncs.length} 個錯誤記錄：\n`);

    errorSyncs.forEach(sync => {
      console.log(`📍 ${sync.entity_type} - ${sync.status}`);
      console.log(`   時間: ${new Date(sync.created_at).toLocaleString()}`);
      console.log(`   錯誤數: ${sync.error_count}`);
      
      if (sync.details) {
        try {
          const details = JSON.parse(sync.details);
          if (details.error) {
            console.log(`   錯誤訊息: ${details.error}`);
          }
        } catch (e) {
          console.log(`   詳情: ${sync.details}`);
        }
      }
      console.log('');
    });

    // 獲取 D1 統計
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    const { tables } = statsResponse.data.data;
    
    console.log('📊 D1 數據統計：');
    console.log(`   商機: ${tables.opportunities} 條`);
    console.log(`   案場: ${tables.sites} 條`);
    console.log(`   同步日誌: ${tables.syncLogs} 條`);

  } catch (error) {
    console.error('檢查失敗:', error.message);
  }
}

checkSyncErrors();