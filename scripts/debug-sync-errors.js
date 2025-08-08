#!/usr/bin/env node

/**
 * 調試同步錯誤
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'https://open.fxiaoke.com';
const APP_ID = 'FSAID_1320691';
const APP_SECRET = 'ec63ff237c5c4a759be36d3a8fb7a3b4';
const PERMANENT_CODE = '899433A4A04A3B8CB1CC2183DA4B5B48';

async function debugSyncErrors() {
  try {
    // 1. 獲取認證
    console.log('獲取認證信息...');
    const tokenResponse = await fetch(`${API_BASE_URL}/cgi/corpAccessToken/get/V2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: APP_ID,
        appSecret: APP_SECRET,
        permanentCode: PERMANENT_CODE
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.errorCode !== 0) {
      throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
    }

    const corpAccessToken = tokenData.corpAccessToken;
    const corpId = tokenData.corpId;

    const userResponse = await fetch(`${API_BASE_URL}/cgi/user/getByMobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        mobile: "17675662629"
      })
    });

    const userData = await userResponse.json();
    const currentOpenUserId = userData.empList?.[0]?.openUserId;
    console.log('✅ 認證成功');

    // 2. 測試維修單數據獲取
    console.log('\n📋 測試維修單數據獲取...');
    const repairResponse = await fetch(`${API_BASE_URL}/cgi/crm/custom/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: 'object_k1XqG__c',
          search_query_info: {
            limit: 2,
            offset: 0,
            filters: []
          }
        }
      })
    });

    const repairData = await repairResponse.json();
    
    if (repairData.errorCode !== 0) {
      console.error('❌ 維修單查詢失敗:', repairData.errorMessage);
      return;
    }

    console.log(`✅ 維修單總數: ${repairData.data?.total || 0}`);
    
    if (repairData.data?.dataList?.length > 0) {
      const sample = repairData.data.dataList[0];
      console.log('\n維修單樣本數據結構:');
      console.log('主要欄位:');
      
      // 檢查關鍵欄位
      const keyFields = ['_id', 'name', 'owner', 'create_time', 'last_modified_time', 'life_status'];
      keyFields.forEach(field => {
        if (sample[field] !== undefined) {
          console.log(`  ✅ ${field}: ${typeof sample[field]} = ${JSON.stringify(sample[field]).substring(0, 50)}`);
        } else {
          console.log(`  ❌ ${field}: 缺失`);
        }
      });
      
      console.log('\n所有欄位:');
      Object.keys(sample).slice(0, 20).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        const preview = JSON.stringify(value).substring(0, 30);
        console.log(`  - ${key}: ${type} = ${preview}${preview.length >= 30 ? '...' : ''}`);
      });
      
      // 檢查問題欄位
      console.log('\n🔍 檢查可能的問題欄位:');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        if (value === null) {
          console.log(`  ⚠️  ${key}: null`);
        } else if (value === '') {
          console.log(`  ⚠️  ${key}: 空字符串`);
        } else if (typeof value === 'object' && Object.keys(value).length === 0) {
          console.log(`  ⚠️  ${key}: 空對象`);
        } else if (Array.isArray(value) && value.length === 0) {
          console.log(`  ⚠️  ${key}: 空數組`);
        }
      });
    }

    // 3. 測試動態表創建邏輯
    console.log('\n🔧 模擬動態表創建...');
    
    if (repairData.data?.dataList?.length > 0) {
      const sample = repairData.data.dataList[0];
      
      // 模擬動態同步邏輯
      console.log('生成的表欄位:');
      const columns = ['_id TEXT PRIMARY KEY'];
      
      for (const [key, value] of Object.entries(sample)) {
        if (key === '_id' || key === 'searchAfterId') continue;
        
        let columnDef = key;
        
        if (typeof value === 'number') {
          columnDef += ' REAL';
        } else if (typeof value === 'boolean') {
          columnDef += ' BOOLEAN';
        } else if (typeof value === 'object' && value !== null) {
          columnDef += ' TEXT';
        } else {
          columnDef += ' TEXT';
        }
        
        columns.push(columnDef);
      }
      
      console.log(`總共 ${columns.length} 個欄位`);
      columns.slice(0, 10).forEach(col => console.log(`  - ${col}`));
      if (columns.length > 10) {
        console.log(`  ... 還有 ${columns.length - 10} 個欄位`);
      }
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
    console.error(error.stack);
  }
}

debugSyncErrors();