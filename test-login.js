const { chromium } = require('playwright');

async function testLogin() {
    console.log('啟動瀏覽器...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('導航到開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev');
        
        // 等待頁面加載
        await page.waitForLoadState('networkidle');
        
        console.log('頁面標題:', await page.title());
        
        // 檢查是否有登入按鈕或表單
        const loginButton = await page.$('button:has-text("登入")');
        const loginForm = await page.$('form');
        const phoneInput = await page.$('input[type="tel"]');
        
        console.log('登入按鈕存在:', !!loginButton);
        console.log('登入表單存在:', !!loginForm);
        console.log('手機號碼輸入框存在:', !!phoneInput);
        
        // 如果找到手機號碼輸入框，嘗試輸入測試數據
        if (phoneInput) {
            console.log('輸入測試手機號碼...');
            await phoneInput.fill('0912345678');
            
            // 尋找密碼輸入框（後三碼）
            const passwordInput = await page.$('input[type="password"]');
            if (passwordInput) {
                console.log('輸入測試後三碼...');
                await passwordInput.fill('678');
                
                // 嘗試提交表單
                const submitButton = await page.$('button[type="submit"]');
                if (submitButton) {
                    console.log('點擊登入按鈕...');
                    await submitButton.click();
                    
                    // 等待響應
                    await page.waitForTimeout(3000);
                    
                    // 檢查是否有錯誤訊息或成功跳轉
                    const errorMessage = await page.$('.error, .alert-error, [class*="error"]');
                    const currentUrl = page.url();
                    
                    console.log('當前 URL:', currentUrl);
                    console.log('錯誤訊息存在:', !!errorMessage);
                    
                    if (errorMessage) {
                        const errorText = await errorMessage.textContent();
                        console.log('錯誤訊息:', errorText);
                    }
                }
            }
        }
        
        // 截圖保存
        console.log('保存截圖...');
        await page.screenshot({ path: 'login-test-screenshot.png' });
        
    } catch (error) {
        console.error('測試過程發生錯誤:', error);
        await page.screenshot({ path: 'login-test-error.png' });
    } finally {
        console.log('關閉瀏覽器...');
        await browser.close();
    }
}

testLogin();