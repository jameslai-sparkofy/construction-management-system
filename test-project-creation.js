const { chromium } = require('playwright');

async function testProjectCreation() {
  // 啟動瀏覽器
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🌐 導航到開發環境首頁...');
    await page.goto('https://construction-management-frontend-dev.pages.dev');
    await page.waitForTimeout(3000);

    // 截圖首頁
    await page.screenshot({ path: 'screenshots/01-homepage.png' });

    console.log('🔐 點擊登入系統...');
    await page.click('a.btn-primary:has-text("登入系統")');
    await page.waitForTimeout(2000);

    // 截圖登入頁面
    await page.screenshot({ path: 'screenshots/02-login.png' });

    console.log('📱 輸入登入資訊...');
    await page.fill('input[type="tel"], input[placeholder*="手機"]', '0963922033');
    await page.fill('input[type="password"], input[placeholder*="密碼"]', '033');
    
    console.log('✅ 點擊登入按鈕...');
    await page.click('button:has-text("登入")');
    await page.waitForTimeout(3000);

    // 截圖專案列表頁面
    await page.screenshot({ path: 'screenshots/03-project-list.png' });

    console.log('➕ 點擊建立新專案...');
    await page.click('button:has-text("建立新專案")');
    await page.waitForTimeout(2000);

    // 截圖專案創建第一步
    await page.screenshot({ path: 'screenshots/04-create-step1.png' });

    console.log('🎯 選擇商機...');
    await page.click('input[type="radio"]');
    await page.waitForTimeout(1000);

    console.log('⏭️ 進入第二步...');
    await page.click('button:has-text("下一步")');
    await page.waitForTimeout(2000);

    // 截圖第二步
    await page.screenshot({ path: 'screenshots/05-create-step2.png' });

    console.log('🏗️ 選擇工程類型 (SPC 石塑地板)...');
    await page.click('div:has-text("SPC 石塑地板")');
    await page.waitForTimeout(1000);

    console.log('⏭️ 進入第三步...');
    await page.click('button:has-text("下一步")');
    await page.waitForTimeout(2000);

    // 截圖第三步
    await page.screenshot({ path: 'screenshots/06-create-step3.png' });

    console.log('⏭️ 進入第四步...');
    await page.click('button:has-text("下一步")');
    await page.waitForTimeout(2000);

    // 截圖第四步
    await page.screenshot({ path: 'screenshots/07-create-step4.png' });

    console.log('🚀 建立專案...');
    await page.click('button:has-text("建立專案")');
    await page.waitForTimeout(5000);

    // 截圖最終結果
    await page.screenshot({ path: 'screenshots/08-final-result.png' });

    console.log('✅ 專案創建測試完成！');

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    await page.screenshot({ path: 'screenshots/error.png' });
  } finally {
    await browser.close();
  }
}

// 執行測試
testProjectCreation();