const { chromium } = require('playwright');

async function debugCorsError() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 攔截所有請求，特別是 /full 端點
  const requests = [];
  const responses = [];
  
  page.on('request', request => {
    if (request.url().includes('/full')) {
      console.log(`📤 /full 請求: ${request.method()} ${request.url()}`);
      console.log(`🔑 Headers:`, request.headers());
      requests.push(request);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/full')) {
      console.log(`📥 /full 響應: ${response.status()} ${response.url()}`);
      console.log(`🔗 Response Headers:`, response.headers());
      responses.push(response);
    }
  });

  // 監聽 Console 錯誤
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🚨 Console Error: ${msg.text()}`);
    }
  });

  // 監聽網路失敗
  page.on('requestfailed', request => {
    if (request.url().includes('/full')) {
      console.log(`❌ /full 請求失敗:`, request.failure());
    }
  });

  try {
    console.log('🔍 調試 CORS/網路錯誤...');
    
    // 先設置 localStorage 以確保認證
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
      console.log('🔧 設置開發令牌');
    });

    // 測試不同的請求方式
    console.log('\n📝 測試 1: 直接 fetch API...');
    const directTest = await page.evaluate(async () => {
      try {
        const response = await fetch(
          'https://construction-management-api-dev.lai-jameslai.workers.dev/api/v1/projects/proj_1755824357367/full',
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer dev-token-for-testing'
            }
          }
        );
        return {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    console.log('直接測試結果:', directTest);

    console.log('\n📝 測試 2: 導航到專案頁面...');
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入
    await page.waitForTimeout(5000);

    // 檢查最終結果
    const projectName = await page.textContent('#projectName').catch(() => '無法獲取');
    const sitesContent = await page.textContent('#gridContent').catch(() => '無法獲取');
    
    console.log(`\n🏗️ 專案名稱: ${projectName}`);
    console.log(`📊 案場內容: ${sitesContent.substring(0, 100)}...`);

    // 分析請求/響應
    console.log(`\n📊 統計:`);
    console.log(`- /full 請求數: ${requests.length}`);
    console.log(`- /full 響應數: ${responses.length}`);

    if (responses.length > 0) {
      const response = responses[0];
      const body = await response.text().catch(e => `無法獲取: ${e.message}`);
      console.log(`📄 響應內容 (前500字符): ${body.substring(0, 500)}`);
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugCorsError().catch(console.error);