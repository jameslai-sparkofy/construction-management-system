#!/usr/bin/env node

/**
 * 詳細調試維修單同步問題
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'https://open.fxiaoke.com';
const APP_ID = 'FSAID_1320691';
const APP_SECRET = 'ec63ff237c5c4a759be36d3a8fb7a3b4';
const PERMANENT_CODE = '899433A4A04A3B8CB1CC2183DA4B5B48';

async function debugRepairOrders() {
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

    // 2. 獲取多個維修單樣本進行對比
    console.log('\n📋 獲取維修單樣本數據...');
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
            limit: 10,
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

    const samples = repairData.data?.dataList || [];
    console.log(`✅ 獲取到 ${samples.length} 個樣本`);

    // 3. 分析所有樣本的欄位結構
    console.log('\n🔍 分析欄位結構差異...');
    
    const allFields = new Set();
    const fieldTypes = {};
    const fieldValues = {};
    
    samples.forEach((sample, index) => {
      console.log(`\n樣本 ${index + 1}: ${sample._id}`);
      
      Object.keys(sample).forEach(key => {
        allFields.add(key);
        
        if (!fieldTypes[key]) {
          fieldTypes[key] = new Set();
          fieldValues[key] = [];
        }
        
        fieldTypes[key].add(typeof sample[key]);
        fieldValues[key].push({
          value: sample[key],
          sample: index + 1,
          id: sample._id
        });
      });
    });

    console.log(`\n📊 總共發現 ${allFields.size} 個不同欄位`);
    
    // 4. 檢查問題欄位
    console.log('\n⚠️ 可能的問題欄位:');
    
    const problemFields = [];
    
    Array.from(allFields).forEach(field => {
      const types = Array.from(fieldTypes[field]);
      const values = fieldValues[field];
      
      // 檢查類型不一致
      if (types.length > 1) {
        console.log(`  - ${field}: 類型不一致 [${types.join(', ')}]`);
        problemFields.push(field);
      }
      
      // 檢查 null/undefined 值
      const nullValues = values.filter(v => v.value === null || v.value === undefined);
      if (nullValues.length > 0) {
        console.log(`  - ${field}: 有 ${nullValues.length} 個 null/undefined 值`);
        problemFields.push(field);
      }
      
      // 檢查特殊字符
      if (field.includes(' ') || field.includes('-') || field.includes('.')) {
        console.log(`  - ${field}: 包含特殊字符`);
        problemFields.push(field);
      }
      
      // 檢查空字符串
      const emptyStrings = values.filter(v => v.value === '');
      if (emptyStrings.length > 0) {
        console.log(`  - ${field}: 有 ${emptyStrings.length} 個空字符串`);
      }
    });

    // 5. 詳細檢查前3個樣本
    console.log('\n🔬 詳細檢查前3個樣本:');
    
    samples.slice(0, 3).forEach((sample, index) => {
      console.log(`\n=== 樣本 ${index + 1}: ${sample._id} ===`);
      
      // 檢查必要欄位
      const requiredFields = ['_id', 'name', 'create_time', 'last_modified_time'];
      requiredFields.forEach(field => {
        if (sample[field] !== undefined) {
          console.log(`  ✅ ${field}: ${typeof sample[field]} = ${JSON.stringify(sample[field])}`);
        } else {
          console.log(`  ❌ ${field}: 缺失`);
        }
      });
      
      // 檢查特殊值
      Object.entries(sample).forEach(([key, value]) => {
        if (value === null) {
          console.log(`  ⚠️  ${key}: null`);
        } else if (value === '') {
          console.log(`  ⚠️  ${key}: 空字符串`);
        } else if (typeof value === 'string' && value.length > 1000) {
          console.log(`  📏 ${key}: 長字符串 (${value.length} 字符)`);
        } else if (Array.isArray(value) && value.length === 0) {
          console.log(`  📋 ${key}: 空數組`);
        } else if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
          console.log(`  📦 ${key}: 空對象`);
        }
      });
    });

    // 6. 生成修復建議
    console.log('\n💡 修復建議:');
    
    if (problemFields.length > 0) {
      console.log('1. 需要特別處理的欄位:');
      [...new Set(problemFields)].forEach(field => {
        console.log(`   - ${field}`);
      });
    }
    
    console.log('2. 建議的 SQL 欄位定義:');
    Array.from(allFields).slice(0, 10).forEach(field => {
      if (field === '_id') {
        console.log(`   "${field}" TEXT PRIMARY KEY`);
      } else if (field === 'searchAfterId') {
        console.log(`   -- 跳過 ${field}`);
      } else {
        const types = fieldTypes[field];
        const hasNumbers = types.has('number');
        const hasObjects = types.has('object');
        
        if (hasNumbers && !hasObjects) {
          console.log(`   "${field}" REAL`);
        } else {
          console.log(`   "${field}" TEXT`);
        }
      }
    });

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
    console.error(error.stack);
  }
}

debugRepairOrders();