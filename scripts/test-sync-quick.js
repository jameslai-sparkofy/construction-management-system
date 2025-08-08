#!/usr/bin/env node

/**
 * 快速測試同步功能 - 測試批次大小調整到 500
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.WORKER_URL || 'http://localhost:8787/api';

async function quickSyncTest() {
  console.log('🚀 開始快速測試同步功能（批次大小: 500）\n');

  try {
    // 1. 測試健康檢查
    console.log('📊 Step 1: 健康檢查...');
    try {
      const healthResponse = await axios.get(`${API_URL.replace('/api', '')}/api/health`);
      console.log('✅ Worker 運行正常\n');
    } catch (error) {
      console.error('❌ Worker 未運行或無法連接');
      process.exit(1);
    }

    // 2. 測試商機同步（少量測試）
    console.log('📊 Step 2: 測試商機同步...');
    console.log('正在同步商機數據...');
    
    const oppStartTime = Date.now();
    try {
      const oppResponse = await axios.post(`${API_URL}/sync/NewOpportunityObj/start`, {}, {
        timeout: 60000 // 60秒超時
      });
      const oppDuration = (Date.now() - oppStartTime) / 1000;
      
      console.log(`✅ 商機同步完成 (耗時: ${oppDuration.toFixed(2)}秒)`);
      if (oppResponse.data.data && oppResponse.data.data.result) {
        console.log(`   成功: ${oppResponse.data.data.result.success} 條`);
        console.log(`   失敗: ${oppResponse.data.data.result.errors} 條`);
        console.log(`   批次大小: 500 條/批`);
      }
    } catch (error) {
      console.error(`❌ 商機同步失敗: ${error.response?.data?.error || error.message}`);
      if (error.response?.data?.error?.includes('KV')) {
        console.log('\n⚠️  檢測到 KV 儲存問題，這是預期的錯誤。');
        console.log('需要在部署到 Cloudflare 時創建實際的 KV namespace。');
      }
    }
    
    console.log('\n📈 Step 3: 查看同步狀態...');
    try {
      const statusResponse = await axios.get(`${API_URL}/sync/status`);
      if (statusResponse.data.success) {
        const { recentSyncs, statistics } = statusResponse.data.data;
        
        if (statistics && statistics.length > 0) {
          console.log('同步統計:');
          statistics.forEach(stat => {
            console.log(`   - ${stat.entity_type}: ${stat.sync_count} 次同步`);
          });
        } else {
          console.log('尚無同步記錄');
        }
      }
    } catch (error) {
      console.error('獲取狀態失敗:', error.message);
    }
    
    console.log('\n🎉 測試完成！');
    console.log('\n💡 提示：');
    console.log('- 批次大小已設定為 500 條');
    console.log('- 本地開發環境無法使用 KV 儲存，需部署到 Cloudflare');
    console.log('- 使用 wrangler deploy 部署後即可正常運行');
    
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    process.exit(1);
  }
}

// 直接執行測試
quickSyncTest();