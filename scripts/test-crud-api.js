/**
 * 測試 CRUD API 功能
 * 測試創建、讀取、更新和刪除功能
 */

const API_BASE = 'https://fx-crm-sync.lai-jameslai.workers.dev';
const BEARER_TOKEN = process.env.BEARER_TOKEN || 'test-token-123';

// 測試數據
const testOpportunity = {
  name: `測試商機 ${new Date().toISOString()}`,
  amount: 100000,
  close_date: new Date().getTime() + 30 * 24 * 60 * 60 * 1000, // 30天後
  account_id: '6508f92086a6c8000190db97', // 使用現有的客戶ID
  sales_stage: '1', // 使用正確的階段代碼
  sales_process_id: '64ec36f86815cf000178aec1', // 使用現有的銷售流程ID
  owner: ['FSUID_6D8AAEFBF14B69998CF7D51D21FD8309'], // 使用陣列格式
  probability: 20,
  field_SdEgv__c: '測試需求描述', // 需求描述 - 必填
  field_lmjjf__c: 'TvP3c4kMA' // 商機可能性 - 必填（高）
};

// 通用請求函數
async function makeRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
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
      console.error(`❌ ${method} ${path} 失敗:`, response.status, data);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`❌ 請求失敗:`, error.message);
    return null;
  }
}

// 測試健康檢查
async function testHealthCheck() {
  console.log('\n📋 測試健康檢查...');
  const response = await makeRequest('GET', '/api/health');
  if (response) {
    console.log('✅ 健康檢查通過:', response);
  }
}

// 測試查詢記錄列表
async function testListRecords() {
  console.log('\n📋 測試查詢記錄列表...');
  const response = await makeRequest('GET', '/api/crud/NewOpportunityObj?pageSize=5');
  if (response && response.success) {
    console.log('✅ 查詢成功:');
    console.log(`   - 總記錄數: ${response.data.pagination.total}`);
    console.log(`   - 當前頁記錄數: ${response.data.records.length}`);
    if (response.data.records.length > 0) {
      console.log(`   - 第一條記錄: ${response.data.records[0].name}`);
    }
  }
}

// 測試創建記錄
async function testCreateRecord() {
  console.log('\n📋 測試創建記錄...');
  console.log('   創建數據:', testOpportunity);
  
  const response = await makeRequest('POST', '/api/crud/NewOpportunityObj', testOpportunity);
  if (response && response.success) {
    console.log('✅ 創建成功:');
    console.log(`   - ID: ${response.data.id}`);
    console.log(`   - 名稱: ${response.data.record.name}`);
    return response.data.id;
  }
  return null;
}

// 測試獲取單條記錄
async function testGetRecord(recordId) {
  console.log('\n📋 測試獲取單條記錄...');
  
  // 從 D1 獲取
  const d1Response = await makeRequest('GET', `/api/crud/NewOpportunityObj/${recordId}`);
  if (d1Response && d1Response.success) {
    console.log('✅ 從 D1 獲取成功:');
    console.log(`   - 名稱: ${d1Response.data.name}`);
    console.log(`   - 金額: ${d1Response.data.amount}`);
  }
  
  // 從 CRM 獲取
  const crmResponse = await makeRequest('GET', `/api/crud/NewOpportunityObj/${recordId}?source=crm`);
  if (crmResponse && crmResponse.success) {
    console.log('✅ 從 CRM 獲取成功:');
    console.log(`   - 來源: ${crmResponse.source}`);
  }
}

// 測試更新記錄
async function testUpdateRecord(recordId) {
  console.log('\n📋 測試更新記錄...');
  
  const updateData = {
    amount: 150000,
    probability: 50,
    sales_stage: 'stage_2'
  };
  
  console.log('   更新數據:', updateData);
  
  const response = await makeRequest('PUT', `/api/crud/NewOpportunityObj/${recordId}`, updateData);
  if (response && response.success) {
    console.log('✅ 更新成功:');
    console.log(`   - 新金額: ${response.data.record.amount}`);
    console.log(`   - 新機率: ${response.data.record.probability}`);
  }
}

// 測試刪除記錄
async function testDeleteRecord(recordId) {
  console.log('\n📋 測試刪除記錄...');
  
  const response = await makeRequest('DELETE', `/api/crud/NewOpportunityObj/${recordId}`);
  if (response && response.success) {
    console.log('✅ 刪除成功:', response.message);
  }
  
  // 驗證刪除
  const checkResponse = await makeRequest('GET', `/api/crud/NewOpportunityObj/${recordId}`);
  if (!checkResponse || !checkResponse.success) {
    console.log('✅ 確認記錄已刪除');
  }
}

// 測試批量創建
async function testBatchCreate() {
  console.log('\n📋 測試批量創建...');
  
  const batchData = {
    records: [
      {
        name: `批量測試商機1 ${new Date().toISOString()}`,
        amount: 50000,
        close_date: new Date().getTime() + 30 * 24 * 60 * 60 * 1000,
        account_id: '6508f92086a6c8000190db97',
        sales_stage: '1',
        sales_process_id: '64ec36f86815cf000178aec1',
        owner: ['FSUID_6D8AAEFBF14B69998CF7D51D21FD8309'],
        field_SdEgv__c: '批量測試需求描述1',
        field_lmjjf__c: 'TvP3c4kMA'
      },
      {
        name: `批量測試商機2 ${new Date().toISOString()}`,
        amount: 80000,
        close_date: new Date().getTime() + 60 * 24 * 60 * 60 * 1000,
        account_id: '6508f92086a6c8000190db97',
        sales_stage: '1',
        sales_process_id: '64ec36f86815cf000178aec1',
        owner: ['FSUID_6D8AAEFBF14B69998CF7D51D21FD8309'],
        field_SdEgv__c: '批量測試需求描述2',
        field_lmjjf__c: 'TvP3c4kMA'
      }
    ]
  };
  
  const response = await makeRequest('POST', '/api/crud/NewOpportunityObj/batch', batchData);
  if (response && response.success) {
    console.log('✅ 批量創建成功:');
    console.log(`   - 成功: ${response.data.success.length} 條`);
    console.log(`   - 失敗: ${response.data.failed.length} 條`);
  }
}

// 主測試函數
async function runTests() {
  console.log('🚀 開始測試 CRUD API...');
  console.log(`   API 基礎 URL: ${API_BASE}`);
  console.log(`   Bearer Token: ${BEARER_TOKEN.substring(0, 10)}...`);
  
  try {
    // 1. 健康檢查
    await testHealthCheck();
    
    // 2. 查詢現有記錄
    await testListRecords();
    
    // 3. 創建新記錄
    const recordId = await testCreateRecord();
    
    if (recordId) {
      // 4. 獲取創建的記錄
      await testGetRecord(recordId);
      
      // 5. 更新記錄
      await testUpdateRecord(recordId);
      
      // 6. 刪除記錄
      await testDeleteRecord(recordId);
    }
    
    // 7. 批量創建測試
    await testBatchCreate();
    
    console.log('\n✅ 所有測試完成！');
    
  } catch (error) {
    console.error('\n❌ 測試過程中發生錯誤:', error);
  }
}

// 執行測試
runTests();