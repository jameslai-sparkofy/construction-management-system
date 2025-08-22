const { chromium } = require('playwright');

async function debugApiError() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 攔截請求以查看詳細資訊
  await page.route('**/construction-management-api-dev.lai-jameslai.workers.dev/**', async (route, request) => {
    console.log(`🔍 攔截請求: ${request.method()} ${request.url()}`);
    console.log(`🔑 Headers:`, request.headers());
    
    // 繼續請求
    const response = await route.fetch();
    const body = await response.text();
    
    console.log(`📥 Response Status: ${response.status()}`);
    console.log(`📄 Response Headers:`, response.headers());
    console.log(`📝 Response Body:`, body.substring(0, 500));
    
    // 如果是錯誤響應，詳細顯示
    if (response.status() !== 200) {
      console.log(`❌ 完整錯誤響應: ${body}`);
    }
    
    route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: body
    });
  });

  try {
    console.log('🐛 調試 API 錯誤...');
    
    // 設置 localStorage 中的認證令牌
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });
    
    // 導航到專案詳情頁面
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待網路請求完成
    await page.waitForTimeout(5000);

    // 檢查頁面狀態
    const projectName = await page.textContent('#projectName').catch(() => '未找到');
    console.log(`🏗️ 最終專案名稱: ${projectName}`);

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugApiError().catch(console.error);