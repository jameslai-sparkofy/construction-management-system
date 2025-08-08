#!/usr/bin/env node

/**
 * 獲取對象的 Schema 信息
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'https://open.fxiaoke.com';
const APP_ID = 'FSAID_1320691';
const APP_SECRET = 'ec63ff237c5c4a759be36d3a8fb7a3b4';
const PERMANENT_CODE = '899433A4A04A3B8CB1CC2183DA4B5B48';

async function getObjectSchema() {
  try {
    // 1. 獲取 Access Token
    console.log('獲取 Access Token...');
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
    console.log('✅ Token 獲取成功');

    // 2. 獲取用戶 ID
    console.log('獲取用戶 ID...');
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
    console.log('用戶響應:', JSON.stringify(userData, null, 2));
    
    if (userData.errorCode !== 0) {
      throw new Error(`獲取用戶 ID 失敗: ${userData.errorMessage}`);
    }

    const currentOpenUserId = userData.empList?.[0]?.openUserId || userData.data?.openUserId || userData.openUserId;
    console.log('✅ 用戶 ID:', currentOpenUserId);

    // 先嘗試不同的對象名稱格式
    const objectsToTry = [
      'object_k1XqG__c',     // 原始格式
      'object_k1xqg__c',     // 全小寫
      'object_K1XqG__c',     // K 大寫
    ];

    let schemaData = null;
    let workingObjectName = null;

    for (const objName of objectsToTry) {
      console.log(`\n嘗試獲取 ${objName} 的 Schema...`);
      const schemaResponse = await fetch(`${API_BASE_URL}/cgi/crm/custom/v2/object/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corpId: corpId,
          corpAccessToken: corpAccessToken,
          currentOpenUserId: currentOpenUserId,
          apiName: objName
        })
      });

      const data = await schemaResponse.json();
      
      if (data.errorCode === 0) {
        schemaData = data;
        workingObjectName = objName;
        console.log(`✅ 成功獲取 ${objName} 的 Schema`);
        break;
      } else {
        console.log(`  ❌ ${objName} 失敗: ${data.errorMessage}`);
      }
    }

    if (!schemaData) {
      console.log('\n所有格式都失敗了，直接嘗試查詢數據...');
    } else {
      const fields = schemaData.data?.fields || [];
      console.log(`✅ 發現 ${fields.length} 個欄位`);
      
      // 顯示前10個欄位
      console.log('\n前10個欄位:');
      fields.slice(0, 10).forEach(field => {
        console.log(`  - ${field.apiName} (${field.label}): ${field.dataType}`);
      });
    }

    // 檢查是否有數據
    const queryObjectName = workingObjectName || 'object_k1XqG__c';
    console.log(`\n查詢 ${queryObjectName} 數據...`);
    const queryResponse = await fetch(`${API_BASE_URL}/cgi/crm/custom/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: queryObjectName,
          search_query_info: {
            limit: 1,
            offset: 0,
            filters: []
          }
        }
      })
    });

    const queryData = await queryResponse.json();
    if (queryData.errorCode === 0) {
      const count = queryData.data?.total || 0;
      console.log(`✅ 維修單數據總數: ${count}`);
      
      if (count > 0 && queryData.data?.dataList?.length > 0) {
        const sample = queryData.data.dataList[0];
        console.log('\n示例數據欄位:');
        Object.keys(sample).slice(0, 10).forEach(key => {
          console.log(`  - ${key}: ${typeof sample[key]} = ${JSON.stringify(sample[key]).substring(0, 50)}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    process.exit(1);
  }
}

getObjectSchema();