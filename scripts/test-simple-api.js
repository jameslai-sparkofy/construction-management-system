#!/usr/bin/env node

/**
 * 簡單測試 API 連接
 */

const fetch = require('node-fetch');

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function testAPI() {
  console.log('🔍 測試 API 連接...\n');

  try {
    // Step 1: 獲取 Token
    console.log('1. 獲取 Access Token...');
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
    console.log('Token Response:', tokenData);

    if (tokenData.errorCode !== 0) {
      throw new Error(`Token 獲取失敗: ${tokenData.errorMessage}`);
    }

    const { corpAccessToken, corpId } = tokenData;
    console.log('✅ Token 獲取成功');
    console.log(`   Corp ID: ${corpId}`);
    console.log(`   Token: ${corpAccessToken.substring(0, 20)}...`);

    // Step 2: 獲取用戶 ID
    console.log('\n2. 獲取用戶 ID...');
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
    console.log('User Response:', userData);

    if (userData.errorCode !== 0) {
      throw new Error(`用戶獲取失敗: ${userData.errorMessage}`);
    }

    const currentOpenUserId = userData.empList[0].openUserId;
    console.log('✅ 用戶 ID 獲取成功');
    console.log(`   User ID: ${currentOpenUserId}`);

    // Step 3: 測試商機查詢
    console.log('\n3. 測試商機查詢...');
    const oppResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: 'NewOpportunityObj',
          search_query_info: {
            limit: 1,
            offset: 0
          }
        }
      })
    });

    const oppData = await oppResponse.json();
    console.log('Opportunity Response:', oppData);

    if (oppData.errorCode === 0) {
      console.log('✅ 商機查詢成功');
      console.log(`   記錄數: ${oppData.data?.dataList?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

// 安裝 node-fetch 如果需要
const { exec } = require('child_process');
exec('npm list node-fetch', (err) => {
  if (err) {
    console.log('安裝 node-fetch...');
    exec('npm install node-fetch@2', (err) => {
      if (!err) testAPI();
    });
  } else {
    testAPI();
  }
});