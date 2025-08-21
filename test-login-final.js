const { chromium } = require('playwright');

async function testLoginFinal() {
  console.log('最終登入測試');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('1. 導航到登入頁面...');
    await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
    await page.waitForLoadState('networkidle');
    
    console.log('2. 檢查頁面載入狀態...');
    console.log('   URL:', page.url());
    console.log('   標題:', await page.title());
    
    console.log('3. 填入測試登入資料...');
    
    // 填入手機號碼
    const phoneInput = await page.$('input[type="tel"], input[name="phone"], #phone');
    if (phoneInput) {
      await phoneInput.fill('0912345678');
      console.log('   ✓ 手機號碼: 0912345678');
    }
    
    // 填入密碼（後三碼）
    const passwordInput = await page.$('input[type="password"], input[name="password"], #password');
    if (passwordInput) {
      await passwordInput.fill('678');
      console.log('   ✓ 後三碼: 678');
    }
    
    console.log('4. 點擊登入按鈕...');
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("登入")');
    if (submitButton) {
      await submitButton.click();
      console.log('   ✓ 已點擊登入按鈕');
    }
    
    console.log('5. 等待響應...');
    await page.waitForTimeout(5000);
    
    console.log('6. 檢查登入結果...');
    console.log('   當前 URL:', page.url());
    
    // 檢查是否有錯誤訊息
    const possibleErrors = await page.$$eval(
      '.error, .alert, .alert-danger, [class*="error"], [class*="alert"], .message',
      elements => elements.map(el => el.textContent.trim()).filter(text => text.length > 0)
    );
    
    if (possibleErrors.length > 0) {
      console.log('   錯誤/訊息:', possibleErrors);
    } else {
      console.log('   沒有發現錯誤訊息');
    }
    
    // 檢查是否跳轉到其他頁面
    if (page.url().includes('projects') || page.url().includes('dashboard')) {
      console.log('   ✓ 似乎成功跳轉到主頁面');
    } else if (page.url().includes('login')) {
      console.log('   ⚠ 仍在登入頁面，可能登入失敗');
    }
    
    console.log('7. 保存截圖...');
    await page.screenshot({ path: 'login-result.png', fullPage: true });
    console.log('   ✓ 截圖已保存: login-result.png');
    
    console.log('\n測試完成！等待 10 秒後關閉瀏覽器...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('測試發生錯誤:', error);
    await page.screenshot({ path: 'login-error.png' });
  } finally {
    await browser.close();
  }
}

testLoginFinal();