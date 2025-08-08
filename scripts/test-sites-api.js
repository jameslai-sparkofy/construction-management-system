#!/usr/bin/env node

/**
 * 測試案場 API - 使用正確做法
 */

const axios = require('axios');

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

// 1. 獲取 Access Token
async function getAccessToken() {
  const response = await axios.post(`${CRM_CONFIG.baseUrl}/cgi/corpAccessToken/get/V2`, {
    appId: CRM_CONFIG.appId,
    appSecret: CRM_CONFIG.appSecret,
    permanentCode: CRM_CONFIG.permanentCode
  });

  const data = response.data;
  if (data.errorCode !== 0) {
    throw new Error(`認證失敗: ${data.errorMessage}`);
  }

  return {
    accessToken: data.corpAccessToken,
    corpId: data.corpId
  };
}

// 2. 設置當前用戶（必須）
async function getCurrentUserId(corpId, accessToken) {
  const response = await axios.post(`${CRM_CONFIG.baseUrl}/cgi/user/getByMobile`, {
    corpId: corpId,
    corpAccessToken: accessToken,
    mobile: "17675662629"
  });

  const data = response.data;
  return data.empList[0].openUserId;
}

// 3. 測試獲取案場
async function testGetSites() {
  console.log('開始測試案場 API...\n');
  
  try {
    // 獲取認證
    console.log('1. 獲取 Access Token...');
    const { accessToken, corpId } = await getAccessToken();
    console.log(`   ✓ corpId: ${corpId}`);
    console.log(`   ✓ accessToken: ${accessToken.substring(0, 20)}...`);
    
    // 獲取用戶ID
    console.log('\n2. 獲取當前用戶 ID...');
    const currentOpenUserId = await getCurrentUserId(corpId, accessToken);
    console.log(`   ✓ currentOpenUserId: ${currentOpenUserId}`);
    
    // 查詢案場
    console.log('\n3. 查詢案場數據...');
    const response = await axios.post(`${CRM_CONFIG.baseUrl}/cgi/crm/custom/v2/data/query`, {
      corpId: corpId,
      corpAccessToken: accessToken,
      currentOpenUserId: currentOpenUserId,
      data: {
        dataObjectApiName: 'object_8W9cb__c',
        search_query_info: {
          limit: 10,  // 先測試 10 條
          offset: 0,
          filters: [
            {
              field_name: 'life_status',
              operator: 'NEQ',
              field_values: ['作废']
            }
          ],
          orders: [{ fieldName: "create_time", isAsc: "false" }]
        }
      }
    });

    const result = response.data;
    console.log(`   ✓ errorCode: ${result.errorCode}`);
    console.log(`   ✓ errorMessage: ${result.errorMessage}`);
    
    if (result.data && result.data.dataList) {
      console.log(`   ✓ 獲取到 ${result.data.dataList.length} 條案場數據`);
      console.log(`   ✓ 總數: ${result.data.total || 'N/A'}`);
      
      // 顯示第一條數據
      if (result.data.dataList.length > 0) {
        const firstSite = result.data.dataList[0];
        console.log('\n第一條案場數據:');
        console.log(`   - ID: ${firstSite._id}`);
        console.log(`   - 名稱: ${firstSite.name}`);
        console.log(`   - 創建時間: ${new Date(firstSite.create_time).toLocaleString()}`);
      }
    }
    
  } catch (error) {
    console.error('\n錯誤:', error.message);
    if (error.response && error.response.data) {
      console.error('詳細錯誤:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testGetSites();