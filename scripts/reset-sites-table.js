#!/usr/bin/env node

/**
 * 重置案場表並重新同步所有資料
 * 這是最簡單直接的方法來獲取那 373 條缺失的資料
 */

const fetch = require('node-fetch');

const D1_API = 'https://fx-d1-rest-api.lai-jameslai.workers.dev';
const WORKER_API = 'https://fx-crm-sync.lai-jameslai.workers.dev';
const AUTH_TOKEN = 'fx-crm-api-secret-2025';

async function resetAndResync() {
  console.log('🔄 重置案場表並重新同步所有資料...\n');

  try {
    // 1. 先備份當前數量
    console.log('1. 檢查當前資料數量...');
    let response = await fetch(`${D1_API}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        sql: 'SELECT COUNT(*) as total FROM object_8w9cb__c'
      })
    });

    const countData = await response.json();
    const currentCount = countData.results?.[0]?.total || 0;
    console.log(`當前案場數量: ${currentCount} 條`);

    // 2. 清空案場表
    console.log('\n2. 清空案場表...');
    response = await fetch(`${D1_API}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        sql: 'DELETE FROM object_8w9cb__c'
      })
    });

    const deleteResult = await response.json();
    console.log(`✅ 已刪除 ${deleteResult.meta?.changes || 0} 條記錄`);

    // 3. 清除同步記錄（強制完整同步）
    console.log('\n3. 清除同步記錄...');
    response = await fetch(`${D1_API}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        sql: "DELETE FROM sync_logs WHERE entity_type = 'object_8W9cb__c'"
      })
    });

    console.log('✅ 已清除同步記錄');

    // 4. 等待一下
    console.log('\n等待 5 秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. 觸發同步（會自動進行完整同步，因為沒有最後同步時間）
    console.log('\n4. 觸發案場同步...');
    response = await fetch(`${WORKER_API}/api/sync/object_8W9cb__c/start`, {
      method: 'POST'
    });

    const syncResult = await response.json();
    console.log('同步請求結果:', syncResult);

    // 6. 等待同步完成（Worker 限制每次 500 條，所以需要多次）
    console.log('\n5. 等待同步完成，每次最多 500 條...');
    console.log('預計需要 7 次同步（3277 ÷ 500）');
    
    for (let i = 0; i < 7; i++) {
      console.log(`\n第 ${i + 1} 次同步...`);
      
      // 等待 30 秒
      for (let j = 0; j < 6; j++) {
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // 觸發下一批同步
      response = await fetch(`${WORKER_API}/api/sync/object_8W9cb__c/start`, {
        method: 'POST'
      });
      
      const result = await response.json();
      console.log(`\n同步結果: ${JSON.stringify(result.data?.result || {})}`);
      
      // 檢查當前數量
      response = await fetch(`${D1_API}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          sql: 'SELECT COUNT(*) as total FROM object_8w9cb__c'
        })
      });
      
      const checkData = await response.json();
      const newCount = checkData.results?.[0]?.total || 0;
      console.log(`當前數量: ${newCount} 條`);
      
      if (newCount >= 3277 || (result.data?.result?.success === 0 && i > 0)) {
        console.log('\n✅ 同步完成！');
        break;
      }
    }

    // 7. 最終驗證
    console.log('\n6. 最終驗證...');
    response = await fetch(`${D1_API}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        sql: 'SELECT COUNT(*) as total FROM object_8w9cb__c'
      })
    });

    const finalData = await response.json();
    const finalCount = finalData.results?.[0]?.total || 0;
    
    console.log('\n========== 最終結果 ==========');
    console.log(`CRM 總數: 3,277 條`);
    console.log(`D1 總數: ${finalCount} 條`);
    console.log(`同步率: ${((finalCount / 3277) * 100).toFixed(1)}%`);
    
    if (finalCount === 3277) {
      console.log('\n✨ 完美！所有案場資料都已成功同步！');
      console.log('包括之前缺失的 373 條記錄！');
    } else if (finalCount > currentCount) {
      console.log(`\n✅ 成功增加了 ${finalCount - currentCount} 條記錄`);
    } else {
      console.log('\n⚠️  同步可能未完全成功，請檢查日誌');
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  }
}

// 執行
resetAndResync();