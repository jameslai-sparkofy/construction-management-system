const { chromium } = require('playwright');

async function testLoginStep2() {
  console.log('步驟 2: 測試實際登入頁面');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('導航到登入頁面...');
    await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
    await page.waitForLoadState('networkidle');
    
    console.log('頁面 URL:', page.url());
    console.log('頁面標題:', await page.title());
    
    // 尋找登入相關元素
    const loginElements = {
      form: await page.$('form'),
      phoneInput: await page.$('input[type="tel"], input[name="phone"], #phone'),
      passwordInput: await page.$('input[type="password"], input[name="password"], #password'),
      submitButton: await page.$('button[type="submit"], input[type="submit"], button:has-text("登入")')
    };
    
    console.log('\n=== 登入元素檢查 ===');
    Object.entries(loginElements).forEach(([key, element]) => {
      console.log(`${key}: ${element ? '✓ 找到' : '✗ 未找到'}`);
    });
    
    // 如果找到手機輸入框，填入測試資料
    if (loginElements.phoneInput) {
      console.log('\n填入測試手機號碼: 0912345678');
      await loginElements.phoneInput.fill('0912345678');
      
      if (loginElements.passwordInput) {
        console.log('填入測試後三碼: 678');
        await loginElements.passwordInput.fill('678');
        
        console.log('\n✓ 測試資料已填入');
        
        // 如果找到提交按鈕，詢問是否要點擊
        if (loginElements.submitButton) {
          console.log('\n是否要點擊登入按鈕測試? (y/n)');
          
          // 等待用戶輸入
          process.stdin.setRawMode(true);
          process.stdin.resume();
          
          const answer = await new Promise(resolve => {
            process.stdin.once('data', data => {
              resolve(data.toString().trim().toLowerCase());
            });
          });
          
          if (answer === 'y') {
            console.log('點擊登入按鈕...');
            await loginElements.submitButton.click();
            
            // 等待響應
            await page.waitForTimeout(3000);
            
            console.log('登入後 URL:', page.url());
            
            // 檢查是否有錯誤訊息
            const errorMsg = await page.$('.error, .alert, [class*="error"], [class*="alert"]');
            if (errorMsg) {
              const errorText = await errorMsg.textContent();
              console.log('錯誤訊息:', errorText);
            } else {
              console.log('沒有發現明顯的錯誤訊息');
            }
          }
        }
      }
    }
    
    // 截圖
    console.log('\n保存截圖...');
    await page.screenshot({ path: 'login-page-test.png' });
    console.log('截圖已保存為 login-page-test.png');
    
    console.log('\n按任意鍵關閉瀏覽器...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    console.error('測試發生錯誤:', error);
    await page.screenshot({ path: 'login-test-error.png' });
  } finally {
    await browser.close();
    process.exit(0);
  }
}

testLoginStep2();