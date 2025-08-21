const { chromium } = require('playwright');

async function testLoginStep1() {
  console.log('步驟 1: 檢查開發環境頁面');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('導航到開發環境...');
    await page.goto('https://construction-management-frontend-dev.pages.dev');
    await page.waitForLoadState('networkidle');
    
    console.log('頁面 URL:', page.url());
    console.log('頁面標題:', await page.title());
    
    // 檢查頁面是否正常載入
    const bodyText = await page.$eval('body', el => el.innerText);
    console.log('頁面內容預覽:', bodyText.substring(0, 200) + '...');
    
    // 尋找登入相關元素
    const loginElements = {
      form: await page.$('form'),
      phoneInput: await page.$('input[type="tel"]'),
      passwordInput: await page.$('input[type="password"]'),
      submitButton: await page.$('button[type="submit"], button:has-text("登入")')
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
        
        console.log('\n✓ 測試資料已填入，可以點擊登入按鈕測試');
      }
    }
    
    // 暫停讓我們手動檢查
    console.log('\n按 Enter 繼續或 Ctrl+C 結束...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    console.error('測試發生錯誤:', error);
  } finally {
    await browser.close();
  }
}

testLoginStep1();