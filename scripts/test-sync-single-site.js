#!/usr/bin/env node

/**
 * 測試同步單筆案場資料
 * 用於調試 offset 2500 之後的同步問題
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function testSyncSingleSite() {
  console.log('🧪 測試同步單筆案場資料...\n');

  try {
    // 1. 先測試較小的 offset（應該成功）
    console.log('1. 測試 offset 2000 的資料（預期成功）...');
    let response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/sync-page`, {
      offset: 2000,
      limit: 1
    });
    
    if (response.data.success) {
      console.log('✅ 成功:', response.data.data.result);
    } else {
      console.log('❌ 失敗:', response.data.error);
    }

    // 2. 測試問題 offset
    console.log('\n2. 測試 offset 2500 的資料（預期失敗）...');
    response = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/sync-page`, {
      offset: 2500,
      limit: 1
    });
    
    if (response.data.success) {
      console.log('✅ 成功:', response.data.data.result);
    } else {
      console.log('❌ 失敗:', response.data.error);
    }

    // 3. 獲取詳細錯誤信息
    console.log('\n3. 查詢最新的錯誤日誌...');
    const logsResponse = await axios.get(`${WORKER_URL}/api/sync/status`);
    const recentErrors = logsResponse.data.data.recentSyncs
      .filter(sync => sync.error_count > 0)
      .slice(0, 1);
    
    if (recentErrors.length > 0) {
      console.log('\n最新錯誤詳情:');
      const errorLog = recentErrors[0];
      console.log(`時間: ${new Date(errorLog.created_at).toLocaleString()}`);
      console.log(`錯誤數: ${errorLog.error_count}`);
      
      if (errorLog.details) {
        try {
          const details = JSON.parse(errorLog.details);
          console.log('詳細信息:', details);
        } catch (e) {
          console.log('詳細信息:', errorLog.details);
        }
      }
    }

    // 4. 使用調試端點獲取具體資料
    console.log('\n4. 直接查看 offset 2500 的資料結構...');
    const debugResponse = await axios.post(`${WORKER_URL}/api/debug/test-fetch-sites`, {
      offset: 2500,
      limit: 1
    });
    
    if (debugResponse.data.success && debugResponse.data.data.length > 0) {
      const site = debugResponse.data.data[0];
      console.log('\n案場資料:');
      console.log(`ID: ${site._id}`);
      console.log(`名稱: ${site.name}`);
      
      // 特別檢查問題欄位
      console.log('\n問題欄位檢查:');
      console.log('field_23Z5i__c:', {
        type: Array.isArray(site.field_23Z5i__c) ? 'array' : typeof site.field_23Z5i__c,
        value: site.field_23Z5i__c,
        length: Array.isArray(site.field_23Z5i__c) ? site.field_23Z5i__c.length : 'N/A'
      });
      
      console.log('relevant_team:', {
        type: Array.isArray(site.relevant_team) ? 'array' : typeof site.relevant_team,
        length: Array.isArray(site.relevant_team) ? site.relevant_team.length : 'N/A'
      });
    }

  } catch (error) {
    console.error('測試失敗:', error.message);
    if (error.response) {
      console.error('錯誤響應:', error.response.data);
    }
  }
}

// 執行測試
testSyncSingleSite();