#!/usr/bin/env node

/**
 * 調試 API 連接問題
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function debugAPI() {
  console.log('🔍 調試 API 連接...\n');

  try {
    // 1. 測試健康檢查
    console.log('1. 健康檢查:');
    const health = await axios.get(`${WORKER_URL}/api/health`);
    console.log('✅ 健康檢查成功');

    // 2. 測試對象列表
    console.log('\n2. 獲取對象列表:');
    try {
      const objects = await axios.get(`${WORKER_URL}/api/objects`);
      console.log('✅ 對象列表獲取成功');
      console.log(`   對象數量: ${objects.data.data?.objects?.length || 0}`);
    } catch (error) {
      console.log('❌ 對象列表獲取失敗:', error.response?.data?.error || error.message);
    }

    // 3. 測試同步狀態
    console.log('\n3. 同步狀態:');
    const status = await axios.get(`${WORKER_URL}/api/sync/status`);
    console.log('✅ 狀態查詢成功');

    // 4. 查看 Worker 診斷信息
    console.log('\n4. Worker 診斷:');
    try {
      const diag = await axios.get(`${WORKER_URL}/api/debug/env`);
      console.log('環境變數狀態:', diag.data);
    } catch (error) {
      console.log('診斷端點不存在（這是正常的）');
    }

    console.log('\n💡 建議：');
    console.log('1. 檢查 Secrets 是否正確設置');
    console.log('2. 使用 wrangler secret list 查看已設置的 secrets');
    console.log('3. 確認 API 憑證是否有效');
    console.log('4. 查看 Worker 日誌: wrangler tail');

  } catch (error) {
    console.error('調試失敗:', error.message);
  }
}

debugAPI();