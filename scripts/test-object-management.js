/**
 * 測試對象管理功能
 * 測試對象發現、啟用/禁用、欄位檢測等功能
 */

const API_BASE = 'https://fx-crm-sync.lai-jameslai.workers.dev';

// 顏色輸出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 通用請求函數
async function makeRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`${colors.red}❌ ${method} ${path} 失敗:${colors.reset}`, response.status, data);
      return { success: false, ...data };
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}❌ 請求失敗:${colors.reset}`, error.message);
    return { success: false, error: error.message };
  }
}

// 測試步驟
async function runTests() {
  console.log(`${colors.blue}🧪 開始測試對象管理功能${colors.reset}\n`);
  
  // 1. 測試獲取對象列表
  console.log(`${colors.yellow}1. 測試獲取對象列表${colors.reset}`);
  const objectsResult = await makeRequest('GET', '/api/objects');
  
  if (objectsResult.success) {
    console.log(`${colors.green}✅ 成功獲取對象列表${colors.reset}`);
    console.log(`   - 標準對象: ${objectsResult.data.defaultObjects.length} 個`);
    console.log(`   - 自定義對象: ${objectsResult.data.customObjects.length} 個`);
    console.log(`   - 總計: ${objectsResult.data.total} 個對象\n`);
    
    // 顯示前 5 個對象
    console.log('   前 5 個標準對象:');
    objectsResult.data.defaultObjects.slice(0, 5).forEach(obj => {
      console.log(`     - ${obj.displayName} (${obj.apiName}) - ${obj.isSynced ? '已同步' : '未同步'}`);
    });
    console.log();
  } else {
    console.log(`${colors.red}❌ 獲取對象列表失敗${colors.reset}\n`);
    return;
  }
  
  // 2. 測試發現對象
  console.log(`${colors.yellow}2. 測試發現對象功能${colors.reset}`);
  const discoverResult = await makeRequest('POST', '/api/objects/discover');
  
  if (discoverResult.success) {
    console.log(`${colors.green}✅ 對象發現完成${colors.reset}`);
    console.log(`   - 總對象數: ${discoverResult.data.total}`);
    console.log(`   - 標準對象: ${discoverResult.data.standard}`);
    console.log(`   - 自定義對象: ${discoverResult.data.custom}\n`);
  } else {
    console.log(`${colors.red}❌ 對象發現失敗${colors.reset}\n`);
  }
  
  // 3. 測試獲取商機對象的欄位
  console.log(`${colors.yellow}3. 測試獲取商機對象欄位${colors.reset}`);
  const fieldsResult = await makeRequest('GET', '/api/objects/NewOpportunityObj/fields');
  
  if (fieldsResult.success) {
    console.log(`${colors.green}✅ 成功獲取商機欄位${colors.reset}`);
    console.log(`   - 系統欄位: ${fieldsResult.data.systemFields.length} 個`);
    console.log(`   - 自定義欄位: ${fieldsResult.data.customFields.length} 個`);
    console.log(`   - 總欄位數: ${fieldsResult.data.totalFields} 個\n`);
    
    // 顯示部分欄位
    console.log('   必填系統欄位:');
    fieldsResult.data.systemFields
      .filter(f => f.isRequired)
      .slice(0, 5)
      .forEach(field => {
        console.log(`     - ${field.displayName} (${field.apiName}) - ${field.fieldType}`);
      });
    console.log();
  } else {
    console.log(`${colors.red}❌ 獲取欄位失敗${colors.reset}\n`);
  }
  
  // 4. 測試獲取案場對象的欄位
  console.log(`${colors.yellow}4. 測試獲取案場對象欄位${colors.reset}`);
  const siteFieldsResult = await makeRequest('GET', '/api/objects/object_8W9cb__c/fields');
  
  if (siteFieldsResult.success) {
    console.log(`${colors.green}✅ 成功獲取案場欄位${colors.reset}`);
    console.log(`   - 系統欄位: ${siteFieldsResult.data.systemFields.length} 個`);
    console.log(`   - 自定義欄位: ${siteFieldsResult.data.customFields.length} 個`);
    console.log(`   - 總欄位數: ${siteFieldsResult.data.totalFields} 個\n`);
  } else {
    console.log(`${colors.red}❌ 獲取案場欄位失敗${colors.reset}\n`);
  }
  
  // 5. 測試搜索對象
  console.log(`${colors.yellow}5. 測試搜索對象功能${colors.reset}`);
  const searchResult = await makeRequest('GET', '/api/objects?search=客戶');
  
  if (searchResult.success) {
    console.log(`${colors.green}✅ 搜索完成${colors.reset}`);
    console.log(`   - 找到 ${searchResult.data.total} 個匹配的對象`);
    
    if (searchResult.data.total > 0) {
      console.log('   匹配的對象:');
      [...searchResult.data.defaultObjects, ...searchResult.data.customObjects]
        .slice(0, 5)
        .forEach(obj => {
          console.log(`     - ${obj.displayName} (${obj.apiName})`);
        });
    }
    console.log();
  } else {
    console.log(`${colors.red}❌ 搜索失敗${colors.reset}\n`);
  }
  
  // 6. 測試檢查未同步的對象
  console.log(`${colors.yellow}6. 檢查未同步的對象${colors.reset}`);
  const allObjectsResult = await makeRequest('GET', '/api/objects');
  
  if (allObjectsResult.success) {
    const unsyncedObjects = [
      ...allObjectsResult.data.defaultObjects,
      ...allObjectsResult.data.customObjects
    ].filter(obj => !obj.isSynced);
    
    console.log(`${colors.green}✅ 找到 ${unsyncedObjects.length} 個未同步對象${colors.reset}`);
    
    if (unsyncedObjects.length > 0) {
      console.log('   前 10 個未同步對象:');
      unsyncedObjects.slice(0, 10).forEach(obj => {
        console.log(`     - ${obj.displayName} (${obj.apiName})`);
      });
      console.log('\n   提示: 使用管理介面或 API 初始化這些對象的表結構');
    }
    console.log();
  }
  
  console.log(`${colors.blue}✨ 測試完成！${colors.reset}`);
  console.log('\n管理介面地址: https://fx-crm-sync.lai-jameslai.workers.dev/');
  console.log('在管理介面中點擊「對象管理」標籤頁即可使用完整功能。');
}

// 執行測試
runTests().catch(error => {
  console.error(`${colors.red}測試過程中發生錯誤:${colors.reset}`, error);
  process.exit(1);
});