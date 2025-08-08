#!/usr/bin/env node

/**
 * 重置並重新同步所有案場資料
 * 用於測試修改後的同步邏輯
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function resetAndSyncSites() {
  console.log('🔄 重置並重新同步所有案場資料...\n');

  try {
    // 1. 清空案場資料表
    console.log('1. 清空案場資料表...');
    const deleteResult = await axios.post(`${WORKER_URL}/api/debug/execute-sql`, {
      sql: `DELETE FROM object_8w9cb__c`
    });
    
    if (deleteResult.data.success) {
      console.log('✅ 已清空案場資料表');
      console.log(`   刪除記錄數: ${deleteResult.data.data.changes}`);
    }

    // 2. 清除同步記錄
    console.log('\n2. 清除同步記錄...');
    const clearLogsResult = await axios.post(`${WORKER_URL}/api/debug/execute-sql`, {
      sql: `DELETE FROM sync_logs WHERE entity_type = 'object_8W9cb__c'`
    });
    
    if (clearLogsResult.data.success) {
      console.log('✅ 已清除同步記錄');
    }

    // 3. 等待一下
    console.log('\n等待 3 秒...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. 觸發完整同步
    console.log('\n3. 觸發完整同步...');
    const syncResponse = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/start`);
    
    if (syncResponse.data.success) {
      console.log('✅ 同步請求已發送');
      console.log(`   結果: ${JSON.stringify(syncResponse.data.data.result)}`);
    }

    // 5. 等待同步完成
    console.log('\n等待同步完成（30秒）...');
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      process.stdout.write('.');
    }
    console.log('');

    // 6. 檢查最終結果
    console.log('\n4. 檢查最終結果...');
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    const { tables } = statsResponse.data.data;
    
    console.log('\n📊 同步結果:');
    console.log(`   CRM 總數: 3277 條`);
    console.log(`   D1 實際: ${tables.sites} 條`);
    console.log(`   同步率: ${((tables.sites / 3277) * 100).toFixed(1)}%`);
    
    if (tables.sites === 3277) {
      console.log('\n✨ 完美！所有案場資料都已成功同步！');
    } else {
      const missing = 3277 - tables.sites;
      console.log(`\n⚠️  還有 ${missing} 條記錄未成功同步`);
      
      // 檢查錯誤
      const errorLogsResult = await axios.post(`${WORKER_URL}/api/debug/execute-sql`, {
        sql: `
          SELECT sync_id, records_count, error_count, created_at
          FROM sync_logs 
          WHERE entity_type = 'object_8W9cb__c' 
          AND error_count > 0 
          ORDER BY created_at DESC 
          LIMIT 5
        `
      });
      
      if (errorLogsResult.data.success && errorLogsResult.data.data.result.length > 0) {
        console.log('\n最近的錯誤記錄:');
        errorLogsResult.data.data.result.forEach(log => {
          console.log(`- ${new Date(log.created_at).toLocaleString()}: ${log.error_count} 個錯誤`);
        });
      }
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

// 執行
resetAndSyncSites();