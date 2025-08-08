#!/usr/bin/env node

/**
 * 測試單條案場記錄同步
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function testSingleSite() {
  console.log('測試單條案場記錄同步...\n');
  
  try {
    // 先獲取一條案場數據（通過 debug API）
    console.log('1. 創建測試端點...');
    
    // 檢查當前數據
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    console.log('當前案場數量:', statsResponse.data.data.tables.sites);
    
    // TODO: 需要創建一個測試端點來獲取單條記錄並測試保存
    
  } catch (error) {
    console.error('測試失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

testSingleSite();