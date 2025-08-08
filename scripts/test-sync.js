#!/usr/bin/env node

/**
 * 測試商機和案場資料同步
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.WORKER_URL || 'http://localhost:8787/api';

async function testDataSync() {
  console.log('🚀 開始測試資料同步功能...\n');

  try {
    // 1. 測試商機同步
    console.log('📊 Step 1: 測試商機對象同步...');
    console.log('正在同步商機數據，這可能需要一些時間...');
    
    const oppStartTime = Date.now();
    const oppResponse = await axios.post(`${API_URL}/sync/NewOpportunityObj/start`);
    const oppDuration = (Date.now() - oppStartTime) / 1000;
    
    if (!oppResponse.data.success) {
      throw new Error(`商機同步失敗: ${oppResponse.data.error}`);
    }
    
    console.log(`✅ 商機同步完成 (耗時: ${oppDuration.toFixed(2)}秒)`);
    console.log(`   成功: ${oppResponse.data.data.result.success} 條`);
    console.log(`   失敗: ${oppResponse.data.data.result.errors} 條\n`);
    
    // 2. 測試案場同步
    console.log('🏢 Step 2: 測試案場對象同步...');
    console.log('正在同步案場數據，這可能需要較長時間...');
    
    const siteStartTime = Date.now();
    const siteResponse = await axios.post(`${API_URL}/sync/object_8W9cb__c/start`);
    const siteDuration = (Date.now() - siteStartTime) / 1000;
    
    if (!siteResponse.data.success) {
      throw new Error(`案場同步失敗: ${siteResponse.data.error}`);
    }
    
    console.log(`✅ 案場同步完成 (耗時: ${siteDuration.toFixed(2)}秒)`);
    console.log(`   成功: ${siteResponse.data.data.result.success} 條`);
    console.log(`   失敗: ${siteResponse.data.data.result.errors} 條\n`);
    
    // 3. 查看同步狀態
    console.log('📈 Step 3: 查看同步狀態...');
    const statusResponse = await axios.get(`${API_URL}/sync/status`);
    
    if (statusResponse.data.success) {
      const { recentSyncs, statistics } = statusResponse.data.data;
      
      console.log('最近同步記錄:');
      recentSyncs.slice(0, 5).forEach(sync => {
        console.log(`   - ${sync.entity_type}: ${sync.status} (${new Date(sync.created_at).toLocaleString()})`);
        console.log(`     記錄數: ${sync.records_count}, 錯誤: ${sync.error_count}`);
      });
      
      console.log('\n同步統計:');
      statistics.forEach(stat => {
        console.log(`   - ${stat.entity_type}:`);
        console.log(`     總次數: ${stat.sync_count}`);
        console.log(`     成功: ${stat.success_count}`);
        console.log(`     失敗: ${stat.failed_count}`);
        console.log(`     最後同步: ${stat.last_sync_time ? new Date(stat.last_sync_time).toLocaleString() : '無'}`);
      });
    }
    
    console.log('\n🎉 同步測試完成！');
    
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    if (error.response?.data) {
      console.error('詳細錯誤:', error.response.data);
    }
    process.exit(1);
  }
}

// 顯示使用說明
console.log('='.repeat(60));
console.log('商機和案場資料同步測試');
console.log('='.repeat(60));
console.log('');
console.log('⚠️  注意事項:');
console.log('1. 請確保已經執行 create-tables.sql 創建資料表');
console.log('2. 請確保Worker已部署並配置正確的API憑證');
console.log('3. 首次同步可能需要較長時間（案場約3000+條記錄）');
console.log('4. 後續同步將使用增量模式，只同步更新的記錄');
console.log('');
console.log('='.repeat(60));
console.log('');

// 詢問是否繼續
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('是否開始同步測試？(y/n): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() === 'y') {
    testDataSync();
  } else {
    console.log('已取消同步測試');
    process.exit(0);
  }
});