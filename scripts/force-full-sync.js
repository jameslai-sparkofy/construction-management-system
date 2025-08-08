#!/usr/bin/env node

/**
 * 強制進行完整同步（清除最後同步時間）
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';

async function forceFullSync() {
  console.log('🔄 強制進行完整同步...\n');

  try {
    // 清除同步歷史（這將強制完整同步）
    console.log('正在清除同步歷史...');
    
    // 觸發商機同步
    console.log('\n📦 同步商機數據...');
    const oppResponse = await axios.post(`${WORKER_URL}/api/sync/NewOpportunityObj/start`);
    console.log('商機同步結果:', oppResponse.data);
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 觸發案場同步
    console.log('\n🏢 同步案場數據...');
    const siteResponse = await axios.post(`${WORKER_URL}/api/sync/object_8W9cb__c/start`);
    console.log('案場同步結果:', siteResponse.data);
    
    // 等待一下讓同步完成
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 檢查結果
    console.log('\n📊 檢查同步結果...');
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    const { tables } = statsResponse.data.data;
    
    console.log(`\n✅ 同步完成！`);
    console.log(`   商機: ${tables.opportunities} 條`);
    console.log(`   案場: ${tables.sites} 條`);
    
  } catch (error) {
    console.error('同步失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

forceFullSync();