#!/usr/bin/env node

/**
 * 檢查 Token 獲取流程
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function checkTokenFlow() {
  console.log('🔍 檢查 Token 獲取流程...\n');

  try {
    // 測試對象列表API，這會觸發token獲取
    console.log('1. 嘗試獲取對象列表（會觸發 token 初始化）:');
    try {
      const response = await axios.get(`${WORKER_URL}/api/objects`);
      console.log('✅ API 調用成功');
      console.log('對象數量:', response.data.data?.objects?.length || 0);
    } catch (error) {
      console.log('❌ 失敗:', error.response?.data?.error || error.message);
    }

    // 檢查 KV 中是否有緩存的 token
    console.log('\n2. 測試商機查詢（使用緩存的 token）:');
    try {
      const response = await axios.post(`${WORKER_URL}/api/sync/NewOpportunityObj/start`);
      console.log('✅ 同步成功');
    } catch (error) {
      console.log('❌ 失敗:', error.response?.data?.error || error.message);
    }

  } catch (error) {
    console.error('檢查失敗:', error.message);
  }
}

checkTokenFlow();