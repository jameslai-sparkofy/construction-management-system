#!/usr/bin/env node

/**
 * 分批同步所有案場數據
 */

const axios = require('axios');

const WORKER_URL = 'https://fx-crm-sync.lai-jameslai.workers.dev';
const BATCH_SIZE = 500; // 每批 500 條
const TOTAL_SITES = 3277; // 總共約 3277 條案場

async function syncAllSites() {
  console.log('🔄 開始分批同步所有案場數據...\n');
  console.log(`總數: ${TOTAL_SITES} 條`);
  console.log(`每批: ${BATCH_SIZE} 條`);
  console.log(`預計批次: ${Math.ceil(TOTAL_SITES / BATCH_SIZE)} 批\n`);
  
  let totalSuccess = 0;
  let totalErrors = 0;
  // 檢查當前已有多少條數據
  const currentStats = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
  const currentSites = currentStats.data.data.tables.sites;
  console.log(`當前已有: ${currentSites} 條案場數據\n`);
  
  let offset = Math.floor(currentSites / BATCH_SIZE) * BATCH_SIZE; // 從最近的批次邊界開始
  let batchNumber = Math.floor(currentSites / BATCH_SIZE) + 1;
  
  try {
    while (offset < TOTAL_SITES) {
      console.log(`\n📦 第 ${batchNumber} 批 (offset: ${offset})...`);
      
      try {
        const response = await axios.post(
          `${WORKER_URL}/api/sync/object_8W9cb__c/page`,
          {
            offset: offset,
            limit: BATCH_SIZE
          }
        );
        
        const { result, hasMore } = response.data.data;
        
        console.log(`   ✓ 獲取: ${result.totalFetched} 條`);
        console.log(`   ✓ 成功: ${result.success} 條`);
        console.log(`   ✓ 失敗: ${result.errors} 條`);
        
        totalSuccess += result.success;
        totalErrors += result.errors;
        
        // 如果沒有更多數據，結束循環
        if (!hasMore || result.totalFetched === 0) {
          console.log('\n沒有更多數據了');
          break;
        }
        
        offset += BATCH_SIZE;
        batchNumber++;
        
        // 等待 2 秒，避免請求過快
        console.log('   等待 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`\n❌ 第 ${batchNumber} 批同步失敗:`, error.message);
        if (error.response) {
          console.error('錯誤詳情:', error.response.data);
        }
        
        // 如果是 Worker 超時，等待更長時間再重試
        if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
          console.log('Worker 超時，等待 10 秒後重試...');
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue; // 重試同一批
        }
        
        break; // 其他錯誤則停止
      }
    }
    
    // 最終統計
    console.log('\n📊 同步完成統計:');
    console.log(`   總成功: ${totalSuccess} 條`);
    console.log(`   總失敗: ${totalErrors} 條`);
    console.log(`   總處理: ${totalSuccess + totalErrors} 條`);
    
    // 檢查最終數據
    const statsResponse = await axios.get(`${WORKER_URL}/api/debug/d1-stats`);
    const { tables } = statsResponse.data.data;
    console.log(`\n📈 D1 數據庫統計:`);
    console.log(`   商機: ${tables.opportunities} 條`);
    console.log(`   案場: ${tables.sites} 條`);
    
  } catch (error) {
    console.error('\n同步過程發生錯誤:', error.message);
  }
}

// 執行同步
syncAllSites();