#!/usr/bin/env node

/**
 * 調試同步失敗的原因
 * 只同步一筆資料看看具體錯誤
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function testSyncDebug() {
  console.log('🔍 調試同步失敗原因...\n');

  try {
    // 1. 先確認 D1 中有多少資料
    console.log('1. 檢查 D1 中的案場資料...');
    const restApi = 'https://fx-d1-rest-api.lai-jameslai.workers.dev';
    const token = 'fx-crm-api-secret-2025';
    
    let response = await axios.get(`${restApi}/rest/object_8w9cb__c?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`D1 中有 ${response.data.results?.length || 0} 筆資料`);
    
    if (response.data.results?.length > 0) {
      console.log('\n現有資料範例:');
      const sample = response.data.results[0];
      console.log(`  _id: ${sample._id}`);
      console.log(`  name: ${sample.name}`);
      console.log(`  field_23Z5i__c: ${sample.field_23Z5i__c}`);
      console.log(`  sync_time: ${sample.sync_time}`);
    }

    // 2. 嘗試同步一小批資料
    console.log('\n\n2. 嘗試同步 offset 0, limit 1...');
    response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/page`, {
      offset: 0,
      limit: 1
    });
    
    console.log('\n同步結果:', JSON.stringify(response.data, null, 2));

    // 3. 檢查最新的同步日誌
    console.log('\n\n3. 檢查同步日誌...');
    response = await axios.get(`${WORKER_URL}/api/sync/status`);
    
    const recentSyncs = response.data.data.recentSyncs
      .filter(s => s.entity_type === 'object_8W9cb__c')
      .slice(0, 3);
    
    console.log('\n最近的案場同步記錄:');
    recentSyncs.forEach(sync => {
      console.log(`\n時間: ${new Date(sync.created_at).toLocaleString()}`);
      console.log(`同步ID: ${sync.sync_id}`);
      console.log(`狀態: ${sync.status}`);
      console.log(`記錄數: ${sync.records_count}`);
      console.log(`錯誤數: ${sync.error_count}`);
      
      if (sync.details) {
        try {
          const details = JSON.parse(sync.details);
          console.log('詳情:', details);
        } catch (e) {
          console.log('詳情:', sync.details);
        }
      }
    });

    // 4. 分析問題
    console.log('\n\n4. 問題分析:');
    console.log('可能的原因：');
    console.log('1. 資料已存在，INSERT 時主鍵衝突');
    console.log('2. field_23Z5i__c 格式問題未完全解決');
    console.log('3. 其他欄位資料格式問題');
    console.log('\n建議：');
    console.log('- 清空 object_8w9cb__c 表再重試');
    console.log('- 或檢查 Worker 日誌看具體錯誤');

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    if (error.response) {
      console.error('響應:', error.response.data);
    }
  }
}

// 執行
testSyncDebug();