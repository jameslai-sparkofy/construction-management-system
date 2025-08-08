#!/usr/bin/env node

/**
 * 比較成功和失敗的案場資料差異
 */

const fetch = require('node-fetch');

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function compareSiteData() {
  console.log('🔍 比較成功和失敗的案場資料...\n');

  try {
    // 獲取認證
    const tokenResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/corpAccessToken/get/V2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: CRM_CONFIG.appId,
        appSecret: CRM_CONFIG.appSecret,
        permanentCode: CRM_CONFIG.permanentCode
      })
    });

    const tokenData = await tokenResponse.json();
    const { corpAccessToken, corpId } = tokenData;

    const userResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/user/getByMobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        mobile: "17675662629"
      })
    });

    const userData = await userResponse.json();
    const currentOpenUserId = userData.openUserId;

    // 獲取成功的資料（offset 1000）
    console.log('1. 獲取成功同步的資料（offset 1000）...');
    let response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/custom/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: 'object_8W9cb__c',
          search_query_info: {
            limit: 1,
            offset: 1000,
            orders: [{ fieldName: 'create_time', isAsc: false }]
          }
        }
      })
    });

    const successData = await response.json();
    const successSite = successData.data?.dataList?.[0];

    // 獲取失敗的資料（offset 2500）
    console.log('2. 獲取失敗同步的資料（offset 2500）...');
    response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/custom/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: 'object_8W9cb__c',
          search_query_info: {
            limit: 1,
            offset: 2500,
            orders: [{ fieldName: 'create_time', isAsc: false }]
          }
        }
      })
    });

    const failData = await response.json();
    const failSite = failData.data?.dataList?.[0];

    // 比較差異
    console.log('\n========== 成功的資料（offset 1000）==========');
    if (successSite) {
      console.log(`ID: ${successSite._id}`);
      console.log(`名稱: ${successSite.name}`);
      analyzeFields(successSite);
    }

    console.log('\n========== 失敗的資料（offset 2500）==========');
    if (failSite) {
      console.log(`ID: ${failSite._id}`);
      console.log(`名稱: ${failSite.name}`);
      analyzeFields(failSite);
    }

    // 找出關鍵差異
    if (successSite && failSite) {
      console.log('\n========== 關鍵差異 ==========');
      
      // 比較所有欄位
      const allKeys = new Set([...Object.keys(successSite), ...Object.keys(failSite)]);
      const differences = [];
      
      allKeys.forEach(key => {
        const successValue = successSite[key];
        const failValue = failSite[key];
        
        // 檢查類型差異
        if (typeof successValue !== typeof failValue) {
          differences.push({
            field: key,
            successType: typeof successValue,
            failType: typeof failValue
          });
        }
        
        // 檢查陣列差異
        if (Array.isArray(successValue) !== Array.isArray(failValue)) {
          differences.push({
            field: key,
            successIsArray: Array.isArray(successValue),
            failIsArray: Array.isArray(failValue)
          });
        }
        
        // 檢查長度差異
        if (typeof successValue === 'string' && typeof failValue === 'string') {
          if (Math.abs(successValue.length - failValue.length) > 100) {
            differences.push({
              field: key,
              successLength: successValue.length,
              failLength: failValue.length
            });
          }
        }
      });
      
      if (differences.length > 0) {
        console.log('發現以下差異：');
        differences.forEach(diff => {
          console.log(`\n欄位: ${diff.field}`);
          Object.entries(diff).forEach(([k, v]) => {
            if (k !== 'field') console.log(`  ${k}: ${v}`);
          });
        });
      } else {
        console.log('沒有發現明顯的結構差異');
      }
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  }
}

function analyzeFields(site) {
  // 分析關鍵欄位
  const keyFields = ['field_23Z5i__c', 'relevant_team', 'owner', 'created_by'];
  
  keyFields.forEach(field => {
    if (site[field] !== undefined) {
      const value = site[field];
      console.log(`\n${field}:`);
      console.log(`  類型: ${Array.isArray(value) ? 'array' : typeof value}`);
      
      if (Array.isArray(value)) {
        console.log(`  長度: ${value.length}`);
        console.log(`  內容: ${JSON.stringify(value)}`);
        console.log(`  JSON長度: ${JSON.stringify(value).length}`);
      } else if (typeof value === 'string') {
        console.log(`  長度: ${value.length}`);
        if (value.length > 50) {
          console.log(`  預覽: ${value.substring(0, 50)}...`);
        } else {
          console.log(`  內容: ${value}`);
        }
      } else {
        console.log(`  值: ${value}`);
      }
    }
  });
}

// 執行
compareSiteData();