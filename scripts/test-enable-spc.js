/**
 * 測試啟用 SPC維修單功能
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

async function testEnableSPC() {
  console.log(`${colors.blue}🧪 測試啟用 SPC維修單${colors.reset}\n`);
  
  // 1. 查找 SPC維修單
  console.log(`${colors.yellow}1. 搜索 SPC維修單${colors.reset}`);
  const searchResult = await makeRequest('GET', '/api/objects?search=SPC維修單');
  
  if (!searchResult.success) {
    console.error('搜索失敗');
    return;
  }
  
  // 在自定義對象中查找
  const spcObject = searchResult.data.customObjects.find(obj => 
    obj.displayName.includes('SPC維修單')
  );
  
  if (!spcObject) {
    console.error(`${colors.red}❌ 未找到 SPC維修單對象${colors.reset}`);
    return;
  }
  
  console.log(`${colors.green}✅ 找到 SPC維修單${colors.reset}`);
  console.log(`   - 名稱: ${spcObject.displayName}`);
  console.log(`   - API 名稱: ${spcObject.apiName}`);
  console.log(`   - 同步狀態: ${spcObject.isSynced ? '已同步' : '未同步'}`);
  console.log(`   - 啟用狀態: ${spcObject.isEnabled ? '已啟用' : '未啟用'}\n`);
  
  // 2. 如果未同步，先初始化表
  if (!spcObject.isSynced) {
    console.log(`${colors.yellow}2. 初始化 SPC維修單表結構${colors.reset}`);
    const initResult = await makeRequest('POST', `/api/objects/${spcObject.apiName}/init-table`);
    
    if (initResult.success) {
      console.log(`${colors.green}✅ 表結構初始化成功${colors.reset}`);
      console.log(`   - 表名: ${initResult.data.tableName}\n`);
    } else {
      console.error(`${colors.red}❌ 初始化失敗: ${initResult.error}${colors.reset}`);
      return;
    }
  }
  
  // 3. 啟用對象
  if (!spcObject.isEnabled) {
    console.log(`${colors.yellow}3. 啟用 SPC維修單${colors.reset}`);
    const enableResult = await makeRequest('POST', `/api/objects/${spcObject.apiName}/toggle`, {
      enabled: true
    });
    
    if (enableResult.success) {
      console.log(`${colors.green}✅ ${enableResult.message}${colors.reset}\n`);
    } else {
      console.error(`${colors.red}❌ 啟用失敗: ${enableResult.error}${colors.reset}`);
      return;
    }
  } else {
    console.log(`${colors.blue}ℹ️  SPC維修單已經是啟用狀態${colors.reset}\n`);
  }
  
  // 4. 同步結構
  console.log(`${colors.yellow}4. 同步 SPC維修單結構${colors.reset}`);
  const syncResult = await makeRequest('POST', `/api/objects/${spcObject.apiName}/sync-schema`);
  
  if (syncResult.success) {
    console.log(`${colors.green}✅ 結構同步完成${colors.reset}`);
    if (syncResult.data.changes) {
      console.log(`   - 變更: ${JSON.stringify(syncResult.data.changes)}`);
    }
  } else {
    console.error(`${colors.red}❌ 結構同步失敗: ${syncResult.error}${colors.reset}`);
  }
  
  // 5. 再次查詢確認狀態
  console.log(`\n${colors.yellow}5. 確認最終狀態${colors.reset}`);
  const finalResult = await makeRequest('GET', '/api/objects?search=SPC維修單');
  
  if (finalResult.success) {
    const finalSpcObject = finalResult.data.customObjects.find(obj => 
      obj.apiName === spcObject.apiName
    );
    
    if (finalSpcObject) {
      console.log(`${colors.green}✅ SPC維修單最終狀態:${colors.reset}`);
      console.log(`   - 同步狀態: ${finalSpcObject.isSynced ? '已同步' : '未同步'}`);
      console.log(`   - 啟用狀態: ${finalSpcObject.isEnabled ? '已啟用' : '未啟用'}`);
      console.log(`   - 表名: ${finalSpcObject.tableName || '無'}`);
    }
  }
  
  console.log(`\n${colors.blue}✨ 測試完成！${colors.reset}`);
  console.log('現在可以在管理介面查看 SPC維修單的狀態。');
}

// 執行測試
testEnableSPC().catch(error => {
  console.error(`${colors.red}測試過程中發生錯誤:${colors.reset}`, error);
  process.exit(1);
});