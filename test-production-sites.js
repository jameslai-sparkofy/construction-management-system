const { chromium } = require('playwright');

async function testProductionSites() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 監聽所有 API 請求
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('api') || request.url().includes('sync.yes-ceramics.com')) {
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });

  // 監聽響應
  const apiResponses = [];
  page.on('response', response => {
    if (response.url().includes('api') || response.url().includes('sync.yes-ceramics.com')) {
      apiResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });

  // 監聽 Console 日誌
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  try {
    console.log('🌟 測試生產環境案場資料...');
    
    // 導航到生產環境
    await page.goto('https://construction-management-frontend-prod.pages.dev/project-detail.html?id=proj_1755824357367', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待載入
    await page.waitForTimeout(5000);

    // 檢查頁面內容
    const projectName = await page.textContent('#projectName').catch(() => '未找到');
    const sitesContent = await page.textContent('#gridContent').catch(() => '未找到');
    const buildingTabs = await page.$$('.building-tab').then(tabs => tabs.length);
    const floorRows = await page.$$('.floor-row').then(rows => rows.length);

    console.log(`\n📊 生產環境結果:`);
    console.log(`🏗️ 專案名稱: ${projectName}`);
    console.log(`📋 案場內容長度: ${sitesContent.length} 字符`);
    console.log(`🏢 建築標籤數: ${buildingTabs}`);
    console.log(`📏 樓層行數: ${floorRows}`);
    console.log(`📄 案場內容預覽: ${sitesContent.substring(0, 200)}...`);

    // 分析 API 請求
    console.log(`\n🌐 API 請求分析:`);
    console.log(`總請求數: ${apiRequests.length}`);
    
    const sitesRequests = apiRequests.filter(req => 
      req.url.includes('object_8W9cb__c') || 
      req.url.includes('/sites') ||
      req.url.includes('/full')
    );
    
    console.log(`案場相關請求: ${sitesRequests.length}`);
    sitesRequests.forEach((req, i) => {
      const response = apiResponses.find(res => res.url === req.url);
      console.log(`  ${i+1}. ${req.method} ${req.url}`);
      console.log(`     狀態: ${response ? response.status : 'pending'}`);
    });

    // 檢查是否有載入錯誤
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    if (errorLogs.length > 0) {
      console.log(`\n🚨 錯誤日誌 (${errorLogs.length} 條):`);
      errorLogs.forEach(log => {
        console.log(`  ${log.text}`);
      });
    }

    // 檢查資料載入相關日誌
    const dataLogs = consoleLogs.filter(log => 
      log.text.includes('sites') || 
      log.text.includes('案場') ||
      log.text.includes('載入') ||
      log.text.includes('OPTIMIZED')
    );
    console.log(`\n📝 資料載入相關日誌 (${dataLogs.length} 條):`);
    dataLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testProductionSites().catch(console.error);