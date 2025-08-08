/**
 * 簡單測試創建商機 API
 */

const API_BASE = 'https://fx-crm-sync.lai-jameslai.workers.dev';
const BEARER_TOKEN = 'test-token-123';

async function testCreate() {
  // 測試數據 - 包含所有必填欄位
  const testData = {
    name: `API測試商機 ${new Date().toISOString()}`,
    amount: 50000,
    close_date: new Date().getTime() + 30 * 24 * 60 * 60 * 1000,
    account_id: '6508f92086a6c8000190db97',
    sales_stage: '1',
    sales_process_id: '64ec36f86815cf000178aec1',
    owner: ['FSUID_6D8AAEFBF14B69998CF7D51D21FD8309'], // 使用陣列格式
    probability: 20,
    field_SdEgv__c: 'API 測試需求描述', // 需求描述 - 必填
    field_lmjjf__c: 'TvP3c4kMA' // 商機可能性 - 必填（高）
  };

  console.log('測試數據:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch(`${API_BASE}/api/crud/NewOpportunityObj`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('\n回應狀態碼:', response.status);
    console.log('回應內容:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('\n❌ 創建失敗');
      
      // 嘗試查看 Worker 日誌提示
      console.log('\n建議檢查:');
      console.log('1. 查看 Worker 日誌: wrangler tail');
      console.log('2. 確認必填欄位');
      console.log('3. 檢查資料格式');
    } else {
      console.log('\n✅ 創建成功!');
    }

  } catch (error) {
    console.error('請求錯誤:', error);
  }
}

// 執行測試
console.log('🚀 開始測試創建商機 API...\n');
testCreate();