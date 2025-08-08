#!/usr/bin/env node

/**
 * 調試案場同步錯誤
 * 找出為什麼有 373 條記錄無法同步
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function debugSiteSyncErrors() {
  console.log('🔍 調試案場同步錯誤...\n');

  try {
    // 1. 獲取最新的錯誤日誌
    console.log('1. 檢查最新的錯誤日誌...');
    const errorLogsResult = await axios.post(`${WORKER_URL}/api/debug/execute-sql`, {
      sql: `
        SELECT sync_id, records_count, error_count, details, created_at
        FROM sync_logs 
        WHERE entity_type = 'object_8W9cb__c' 
        AND error_count > 0 
        ORDER BY created_at DESC 
        LIMIT 5
      `
    });

    if (errorLogsResult.data.success && errorLogsResult.data.data.result.length > 0) {
      console.log('發現錯誤記錄:');
      errorLogsResult.data.data.result.forEach(log => {
        console.log(`\n時間: ${log.created_at}`);
        console.log(`記錄數: ${log.records_count}, 錯誤數: ${log.error_count}`);
        if (log.details) {
          try {
            const details = JSON.parse(log.details);
            console.log(`Offset: ${details.offset}, Limit: ${details.limit}`);
          } catch (e) {
            console.log(`詳情: ${log.details}`);
          }
        }
      });
    }

    // 2. 直接測試一條失敗的記錄
    console.log('\n\n2. 測試獲取失敗範圍的數據...');
    console.log('嘗試從 offset 2500 獲取 1 條記錄進行分析...');
    
    const testResult = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/test-fetch`, {
      offset: 2500,
      limit: 1
    });

    if (testResult.data.success) {
      const record = testResult.data.data[0];
      console.log('\n獲取到的記錄:');
      console.log(`ID: ${record._id}`);
      console.log(`名稱: ${record.name}`);
      console.log(`狀態欄位 (field_23Z5i__c):`, record.field_23Z5i__c);
      console.log(`類型:`, typeof record.field_23Z5i__c);
      
      // 檢查特殊欄位
      const problematicFields = [];
      
      // 檢查陣列欄位
      if (Array.isArray(record.field_23Z5i__c)) {
        problematicFields.push('field_23Z5i__c 是陣列');
      }
      
      // 檢查超長欄位
      Object.keys(record).forEach(key => {
        const value = record[key];
        if (typeof value === 'string' && value.length > 1000) {
          problematicFields.push(`${key} 超長 (${value.length} 字元)`);
        }
      });
      
      if (problematicFields.length > 0) {
        console.log('\n🚨 發現問題欄位:');
        problematicFields.forEach(p => console.log(`   - ${p}`));
      }
    }

    // 3. 檢查資料庫欄位限制
    console.log('\n\n3. 檢查資料庫欄位結構...');
    const schemaResult = await axios.post(`${WORKER_URL}/api/debug/execute-sql`, {
      sql: `PRAGMA table_info(object_8w9cb__c)`
    });

    if (schemaResult.data.success) {
      const columns = schemaResult.data.data.result;
      const textColumns = columns.filter(col => col.type === 'TEXT');
      console.log(`TEXT 類型欄位數: ${textColumns.length}`);
      
      // 找出可能有問題的欄位
      const arrayFields = ['field_23Z5i__c', 'relevant_team', 'owner', 'created_by', 'last_modified_by', 'data_own_department'];
      console.log('\n需要特殊處理的陣列欄位:');
      arrayFields.forEach(field => {
        const col = columns.find(c => c.name === field);
        if (col) {
          console.log(`   - ${field}: ${col.type}`);
        }
      });
    }

    // 4. 建議解決方案
    console.log('\n\n💡 建議解決方案:');
    console.log('1. 修改 bindSiteData 方法，正確處理陣列欄位');
    console.log('2. 對於 field_23Z5i__c，應該取陣列的第一個元素而不是 JSON.stringify');
    console.log('3. 增加錯誤處理，記錄具體哪條記錄失敗');
    console.log('4. 考慮增加資料驗證，跳過有問題的記錄');

  } catch (error) {
    console.error('調試失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

// 執行調試
debugSiteSyncErrors();