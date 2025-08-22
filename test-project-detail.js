const { chromium } = require('playwright');

async function testProjectDetail() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 監聽所有網路請求
  const requests = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      timestamp: Date.now()
    });
  });

  // 監聽 Console 輸出
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now()
    });
  });

  // 監聽網路響應
  const responses = [];
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      timestamp: Date.now()
    });
  });

  try {
    console.log('🚀 開始測試專案詳情頁面...');
    const startTime = Date.now();
    
    // 導航到專案詳情頁面
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    console.log(`⏱️ 頁面載入時間: ${loadTime}ms`);

    // 等待頁面載入完成
    await page.waitForTimeout(3000);

    // 檢查頁面標題
    const title = await page.title();
    console.log(`📄 頁面標題: ${title}`);

    // 檢查專案名稱是否載入
    const projectName = await page.textContent('#projectName').catch(() => '未找到');
    console.log(`🏗️ 專案名稱: ${projectName}`);

    // 檢查案場載入狀態
    const gridContent = await page.textContent('#gridContent').catch(() => '未找到');
    console.log(`📊 案場內容: ${gridContent.substring(0, 100)}...`);

    // 檢查是否有載入錯誤
    const errorElements = await page.$$('.error, .loading');
    console.log(`❗ 錯誤/載入元素數量: ${errorElements.length}`);

    // 分析 Console 日誌
    console.log('\n📋 Console 日誌 (最後 10 條):');
    consoleLogs.slice(-10).forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

    // 分析 API 請求
    console.log('\n🌐 API 請求統計:');
    const apiRequests = requests.filter(req => 
      req.url.includes('construction-management-api') || 
      req.url.includes('sync.yes-ceramics.com')
    );
    console.log(`  總 API 請求數: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      const response = responses.find(res => res.url === req.url);
      console.log(`  ${req.method} ${req.url} - ${response ? response.status : 'pending'}`);
    });

    // 檢查批次 API 是否被調用
    const fullApiRequest = apiRequests.find(req => req.url.includes('/full'));
    if (fullApiRequest) {
      console.log('✅ 批次 API (/full) 被調用');
      const fullApiResponse = responses.find(res => res.url === fullApiRequest.url);
      console.log(`   狀態碼: ${fullApiResponse ? fullApiResponse.status : 'pending'}`);
    } else {
      console.log('❌ 批次 API (/full) 未被調用');
    }

    // 檢查優化日誌
    const optimizedLogs = consoleLogs.filter(log => 
      log.text.includes('OPTIMIZED') || 
      log.text.includes('batch') ||
      log.text.includes('批次')
    );
    console.log(`⚡ 優化相關日誌: ${optimizedLogs.length} 條`);
    optimizedLogs.forEach(log => {
      console.log(`  ${log.text}`);
    });

    // 檢查建築統計圓餅圖
    const pieCharts = await page.$$('.pie-chart');
    console.log(`🥧 圓餅圖數量: ${pieCharts.length}`);

    // 檢查樓層表格
    const floorGrid = await page.$('.floor-grid');
    console.log(`📋 樓層表格: ${floorGrid ? '存在' : '不存在'}`);

    // 等待額外載入
    await page.waitForTimeout(2000);

    console.log('\n✅ 測試完成');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    
    // 顯示錯誤時的 Console 日誌
    console.log('\n🚨 錯誤時的 Console 日誌:');
    consoleLogs.slice(-5).forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });
  } finally {
    await browser.close();
  }
}

testProjectDetail().catch(console.error);