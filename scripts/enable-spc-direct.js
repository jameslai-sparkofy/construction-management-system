/**
 * 直接啟用 SPC維修單
 * 創建基本表結構，稍後可以通過 sync-schema 同步完整欄位
 */

const API_BASE = 'https://fx-crm-sync.lai-jameslai.workers.dev';

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
  
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();
  return data;
}

async function enableSPCDirect() {
  console.log('直接啟用 SPC維修單...\n');
  
  // 1. 創建基本表結構（通過 debug API）
  console.log('1. 創建基本表結構...');
  const createTableResult = await makeRequest('POST', '/api/debug/execute-sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS object_k1xqg__c (
        id TEXT PRIMARY KEY,
        fx_object_id TEXT UNIQUE NOT NULL,
        name TEXT,
        owner TEXT,
        created_by TEXT,
        updated_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        fx_created_at DATETIME,
        fx_updated_at DATETIME,
        sync_version INTEGER DEFAULT 0,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `
  });
  
  if (createTableResult.success) {
    console.log('✅ 表結構創建成功\n');
  } else {
    console.error('❌ 創建表失敗:', createTableResult.error);
    return;
  }
  
  // 2. 更新對象狀態為已同步
  console.log('2. 更新對象狀態...');
  const updateResult = await makeRequest('POST', '/api/debug/execute-sql', {
    sql: `
      UPDATE fx_object_definitions 
      SET is_synced = TRUE, 
          is_enabled = TRUE,
          table_name = 'object_k1xqg__c',
          updated_at = CURRENT_TIMESTAMP
      WHERE api_name = 'object_k1XqG__c'
    `
  });
  
  if (updateResult.success) {
    console.log('✅ 對象狀態更新成功\n');
  } else {
    console.error('❌ 更新狀態失敗:', updateResult.error);
    return;
  }
  
  // 3. 驗證結果
  console.log('3. 驗證結果...');
  const checkResult = await makeRequest('GET', '/api/objects?search=SPC維修單');
  
  if (checkResult.success) {
    const spcObject = checkResult.data.customObjects.find(obj => 
      obj.apiName === 'object_k1XqG__c'
    );
    
    if (spcObject) {
      console.log('✅ SPC維修單狀態:');
      console.log('   - 同步狀態:', spcObject.isSynced ? '已同步' : '未同步');
      console.log('   - 啟用狀態:', spcObject.isEnabled ? '已啟用' : '未啟用');
      console.log('   - 表名:', spcObject.tableName || '無');
      
      console.log('\n✨ SPC維修單已成功啟用！');
      console.log('後續可以使用「同步結構」功能來同步完整的欄位定義。');
    }
  }
}

// 執行
enableSPCDirect().catch(error => {
  console.error('錯誤:', error);
  process.exit(1);
});