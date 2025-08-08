/**
 * 測試獲取對象欄位定義
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
  
  if (userData.empList && userData.empList.length > 0) {
    const userId = userData.empList[0].openUserId;
    console.log('✅ 用戶 ID:', userId);
    return userId;
  } else {
    throw new Error('無法獲取用戶 ID');
  }
}

async function describeObject(corpId, accessToken, userId, objectApiName) {
  console.log(`\n3. 獲取對象 ${objectApiName} 的欄位定義...`);
  
  // 嘗試 describe API
  const response = await fetch(`${baseUrl}/cgi/crm/v2/object/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corpId: corpId,
      corpAccessToken: accessToken,
      currentOpenUserId: userId,
      data: {
        objectApiName: objectApiName
      }
    })
  });
  
  const data = await response.json();
  console.log('API 響應:', JSON.stringify(data, null, 2));
  
  if (data.errorCode !== 0) {
    throw new Error(`獲取欄位失敗: ${data.errorMessage}`);
  }
  
  return data.data;
}

async function main() {
  try {
    // 獲取認證信息
    const { corpId, accessToken } = await getAccessToken();
    const userId = await getUserId(corpId, accessToken);
    
    // 測試幾個對象
    const testObjects = [
      'NewOpportunityObj',     // 商機
      'object_8W9cb__c',       // 案場
      'object_k1XqG__c'        // SPC維修單
    ];
    
    for (const objectApiName of testObjects) {
      console.log('\n' + '='.repeat(50));
      console.log(`測試對象: ${objectApiName}`);
      console.log('='.repeat(50));
      
      try {
        const objectData = await describeObject(corpId, accessToken, userId, objectApiName);
        
        if (objectData) {
          console.log('\n✅ 成功獲取對象資訊');
          console.log('對象名稱:', objectData.label || objectData.displayName);
          console.log('API 名稱:', objectData.apiName);
          console.log('欄位數量:', objectData.fields?.length || 0);
          
          if (objectData.fields && objectData.fields.length > 0) {
            console.log('\n前 5 個欄位:');
            objectData.fields.slice(0, 5).forEach(field => {
              console.log(`  - ${field.label || field.displayName} (${field.apiName}) - ${field.type || field.fieldType}`);
            });
          }
        }
      } catch (error) {
        console.error(`❌ 獲取 ${objectApiName} 失敗:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    process.exit(1);
  }
}

main();