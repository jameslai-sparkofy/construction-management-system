/**
 * 直接測試紛享銷客對象列表 API
 */

const baseUrl = 'https://open.fxiaoke.com';

// API 憑證
const credentials = {
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function getAccessToken() {
  console.log('1. 獲取 Access Token...');
  
  const tokenResponse = await fetch(`${baseUrl}/cgi/corpAccessToken/get/V2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  
  const tokenData = await tokenResponse.json();
  
  if (tokenData.errorCode !== 0) {
    throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
  }
  
  console.log('✅ Token 獲取成功');
  return {
    corpId: tokenData.corpId,
    accessToken: tokenData.corpAccessToken
  };
}

async function getUserId(corpId, accessToken) {
  console.log('\n2. 獲取用戶 ID...');
  
  const userResponse = await fetch(`${baseUrl}/cgi/user/getByMobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corpId: corpId,
      corpAccessToken: accessToken,
      mobile: "17675662629"
    })
  });
  
  const userData = await userResponse.json();
  
  if (userData.errorCode !== 0) {
    throw new Error(`獲取用戶失敗: ${userData.errorMessage}`);
  }
  
  // 從 empList 中獲取用戶 ID
  if (userData.empList && userData.empList.length > 0) {
    const userId = userData.empList[0].openUserId;
    console.log('✅ 用戶 ID:', userId);
    return userId;
  } else {
    throw new Error('無法獲取用戶 ID: ' + JSON.stringify(userData));
  }
}

async function getObjectList(corpId, accessToken, userId) {
  console.log('\n3. 獲取對象列表...');
  
  // 根據文檔 https://open.fxiaoke.com/open/openindex/wiki.html#artiId=974
  // 使用對象列表 API
  try {
    const response = await fetch(`${baseUrl}/cgi/crm/v2/object/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: accessToken,
        currentOpenUserId: userId
      })
    });
    
    const text = await response.text();
    console.log('API 響應:', text.substring(0, 200), '...');
    
    // 嘗試解析 JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('響應不是有效的 JSON: ' + text.substring(0, 100));
    }
    
    if (data.errorCode !== 0) {
      throw new Error(`獲取對象列表失敗: ${data.errorMessage}`);
    }
    
    return data.data;
  } catch (error) {
    console.error('API 調用失敗:', error);
    throw error;
  }
}

async function main() {
  try {
    // 獲取認證信息
    const { corpId, accessToken } = await getAccessToken();
    const userId = await getUserId(corpId, accessToken);
    
    // 獲取對象列表
    const objectData = await getObjectList(corpId, accessToken, userId);
    
    console.log('\n✅ 成功獲取對象列表！');
    
    // 處理對象數據
    const objects = objectData.objects || objectData.dataList || [];
    console.log('對象總數:', objects.length);
    
    // 分類對象
    const standardObjects = objects.filter(obj => {
      const apiName = obj.describeApiName || obj.apiName;
      return !apiName.includes('__c');
    });
    const customObjects = objects.filter(obj => {
      const apiName = obj.describeApiName || obj.apiName;
      return apiName.includes('__c');
    });
    
    console.log('\n標準對象:', standardObjects.length, '個');
    console.log('前 10 個標準對象:');
    standardObjects.slice(0, 10).forEach(obj => {
      const name = obj.describeDisplayName || obj.label;
      const apiName = obj.describeApiName || obj.apiName;
      console.log(`  - ${name} (${apiName})`);
    });
    
    console.log('\n自定義對象:', customObjects.length, '個');
    console.log('前 10 個自定義對象:');
    customObjects.slice(0, 10).forEach(obj => {
      const name = obj.describeDisplayName || obj.label;
      const apiName = obj.describeApiName || obj.apiName;
      console.log(`  - ${name} (${apiName})`);
    });
    
    // 查找特定對象
    const opportunity = objects.find(obj => {
      const apiName = obj.describeApiName || obj.apiName;
      return apiName === 'NewOpportunityObj';
    });
    const site = objects.find(obj => {
      const apiName = obj.describeApiName || obj.apiName;
      return apiName === 'object_8W9cb__c';
    });
    
    console.log('\n已知對象:');
    if (opportunity) {
      const name = opportunity.describeDisplayName || opportunity.label;
      const apiName = opportunity.describeApiName || opportunity.apiName;
      console.log(`  - 商機: ${name} (${apiName})`);
    }
    if (site) {
      const name = site.describeDisplayName || site.label;
      const apiName = site.describeApiName || site.apiName;
      console.log(`  - 案場: ${name} (${apiName})`);
    }
    
  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    process.exit(1);
  }
}

main();