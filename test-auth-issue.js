const { chromium } = require('playwright');

async function testAuthIssue() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 監聽所有請求和響應
  page.on('request', request => {
    if (request.url().includes('construction-management-api')) {
      console.log(`📤 Request: ${request.method()} ${request.url()}`);
      console.log(`🔑 Auth header: ${request.headers()['authorization'] || '無'}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('construction-management-api')) {
      console.log(`📥 Response: ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('🔍 測試認證問題...');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待頁面載入
    await page.waitForTimeout(1000);

    // 檢查 localStorage 中的 auth_token
    const authToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token');
    });
    console.log(`💾 localStorage auth_token: ${authToken || '無'}`);

    // 手動設置 dev token 到 localStorage
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
      console.log('🔧 已設置開發令牌到 localStorage');
    });

    // 重新載入頁面
    console.log('🔄 重新載入頁面...');
    await page.reload({ waitUntil: 'networkidle' });

    // 等待並檢查結果
    await page.waitForTimeout(5000);

    // 檢查專案名稱
    const projectName = await page.textContent('#projectName').catch(() => '載入失敗');
    console.log(`🏗️ 專案名稱: ${projectName}`);

    // 檢查案場資料
    const gridContent = await page.textContent('#gridContent').catch(() => '載入失敗');
    console.log(`📊 案場內容狀態: ${gridContent.includes('載入') ? '載入中' : gridContent.includes('暫無') ? '無資料' : '有資料'}`);

    // 檢查 console 日誌中的錯誤
    const consoleLogs = await page.evaluate(() => {
      return window.console.logs || [];
    });

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testAuthIssue().catch(console.error);