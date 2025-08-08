/**
 * 直接測試紛享銷客創建 API
 */

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

// 獲取 Access Token
async function getAccessToken() {
  const response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/corpAccessToken/get/V2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: CRM_CONFIG.appId,
      appSecret: CRM_CONFIG.appSecret,
      permanentCode: CRM_CONFIG.permanentCode
    })
  });

  const data = await response.json();
  if (data.errorCode !== 0) {
    throw new Error(`認證失敗: ${data.errorMessage}`);
  }

  console.log('✅ 獲取 Token 成功');
  return {
    accessToken: data.corpAccessToken,
    corpId: data.corpId
  };
}

// 獲取當前用戶ID
async function getCurrentUserId(corpId, accessToken) {
  const response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/user/getByMobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corpId: corpId,
      corpAccessToken: accessToken,
      mobile: "17675662629"
    })
  });

  const data = await response.json();
  if (data.errorCode !== 0) {
    throw new Error(`獲取用戶失敗: ${data.errorMessage}`);
  }

  console.log('✅ 獲取用戶ID成功:', data.empList[0].openUserId);
  return data.empList[0].openUserId;
}

// 測試創建商機
async function testCreateOpportunity() {
  try {
    // 1. 獲取認證
    const { accessToken, corpId } = await getAccessToken();
    const currentOpenUserId = await getCurrentUserId(corpId, accessToken);

    // 2. 準備創建數據
    const createData = {
      corpId: corpId,
      corpAccessToken: accessToken,
      currentOpenUserId: currentOpenUserId,
      data: {
        object_data: {
          dataObjectApiName: 'NewOpportunityObj',
          name: `直接API測試 ${new Date().toISOString()}`,
          account_id: '6508f92086a6c8000190db97',
          close_date: new Date().getTime() + 30 * 24 * 60 * 60 * 1000,
          owner: [currentOpenUserId],
          sales_stage: '1',
          sales_process_id: '64ec36f86815cf000178aec1',
          field_SdEgv__c: 'API 測試需求描述', // 需求描述 - 必填欄位
          field_lmjjf__c: 'TvP3c4kMA', // 商機可能性 - 必填欄位（高）
          probability: 20 // 赢率
        }
      }
    };

    console.log('\n📋 發送創建請求...');
    console.log('請求數據:', JSON.stringify(createData, null, 2));

    // 3. 調用創建 API
    const response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/v2/data/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createData)
    });

    const result = await response.json();
    console.log('\n📋 API 回應:');
    console.log(JSON.stringify(result, null, 2));

    if (result.errorCode === 0) {
      console.log('\n✅ 創建成功! ID:', result.data?.data_id || result.data?.dataId);
    } else {
      console.log('\n❌ 創建失敗:', result.errorMessage);
    }

  } catch (error) {
    console.error('\n❌ 發生錯誤:', error);
  }
}

// 執行測試
console.log('🚀 開始直接測試紛享銷客創建 API...\n');
testCreateOpportunity();