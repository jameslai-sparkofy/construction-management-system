#!/usr/bin/env node

/**
 * 檢查 D1 中的案場數據
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function checkD1Sites() {
  console.log('📊 檢查 D1 案場數據...\n');

  try {
    // 獲取統計
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    const { tables } = statsResponse.data.data;
    
    console.log(`D1 數據庫統計：`);
    console.log(`   商機: ${tables.opportunities} 條`);
    console.log(`   案場: ${tables.sites} 條`);
    console.log(`   同步日誌: ${tables.syncLogs} 條`);
    
    // 嘗試查詢最新的幾條案場
    console.log('\n正在查詢最新案場數據...');
    
    // 通過 API 查詢（需要添加一個查詢端點）
    // 目前先只顯示統計
    
    console.log('\n✅ 案場數據統計完成');
    
    if (tables.sites < 3277) {
      console.log(`\n⚠️  注意：還有 ${3277 - tables.sites} 條案場數據未同步`);
      console.log('可能原因：');
      console.log('1. Worker 執行時間限制');
      console.log('2. D1 批量操作限制');
      console.log('3. 數據重複（UNIQUE 約束）');
    } else {
      console.log('\n✅ 所有案場數據已同步完成！');
    }
    
  } catch (error) {
    console.error('檢查失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

checkD1Sites();