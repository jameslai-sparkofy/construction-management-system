const { chromium } = require('playwright');

async function testNewProject() {
    console.log('開始測試新建專案功能...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        // 1. 訪問開發環境首頁
        console.log('1. 訪問開發環境首頁...');
        await page.goto('https://construction-management-frontend-dev.pages.dev', { 
            waitUntil: 'networkidle' 
        });
        
        // 截圖記錄
        await page.screenshot({ path: 'screenshots/01-homepage.png' });
        console.log('   ✓ 首頁截圖已保存');
        
        // 2. 點擊登入
        console.log('2. 點擊登入按鈕...');
        await page.click('text=登入系統');
        await page.waitForLoadState('networkidle');
        
        // 截圖記錄
        await page.screenshot({ path: 'screenshots/02-login.png' });
        console.log('   ✓ 登入頁面截圖已保存');
        
        // 3. 填寫測試帳號（使用常見的測試帳號格式）
        console.log('3. 填寫測試帳號...');
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678'); // 手機號碼末三位
        
        // 4. 提交登入
        console.log('4. 提交登入...');
        await page.click('button[type="submit"]');
        
        // 等待登入結果
        await page.waitForTimeout(3000);
        
        // 檢查是否成功登入（可能跳轉到專案列表頁面）
        const currentUrl = page.url();
        console.log('   當前 URL:', currentUrl);
        
        if (currentUrl.includes('project-list.html')) {
            console.log('   ✓ 登入成功，已跳轉至專案列表');
            
            // 5. 截圖專案列表頁面
            await page.screenshot({ path: 'screenshots/03-project-list.png' });
            console.log('   ✓ 專案列表截圖已保存');
            
            // 6. 點擊建立新專案
            console.log('5. 點擊建立新專案...');
            const createButton = await page.locator('text=建立專案').or(
                page.locator('text=新建專案')
            ).or(
                page.locator('text=+ 建立專案')
            ).first();
            
            if (await createButton.count() > 0) {
                await createButton.click();
                await page.waitForLoadState('networkidle');
                
                // 7. 截圖專案建立頁面
                await page.screenshot({ path: 'screenshots/04-create-step1.png' });
                console.log('   ✓ 專案建立頁面截圖已保存');
                
                // 8. 測試選擇商機（如果有資料）
                console.log('6. 測試商機選擇...');
                await page.waitForTimeout(2000); // 等待資料載入
                
                const opportunityRows = await page.locator('#opportunitiesTableBody tr').count();
                console.log(`   發現 ${opportunityRows} 個商機`);
                
                if (opportunityRows > 0) {
                    // 選擇第一個商機
                    await page.click('#opportunitiesTableBody tr:first-child input[type="radio"]');
                    console.log('   ✓ 已選擇第一個商機');
                    
                    // 點擊下一步
                    await page.click('#step1-next');
                    await page.waitForTimeout(1000);
                    
                    // 9. 截圖工程類型選擇
                    await page.screenshot({ path: 'screenshots/05-create-step2.png' });
                    console.log('   ✓ 工程類型選擇截圖已保存');
                    
                    // 選擇工程類型（如果有）
                    const engineeringTypes = await page.locator('.engineering-type-card').count();
                    console.log(`   發現 ${engineeringTypes} 種工程類型`);
                    
                    if (engineeringTypes > 0) {
                        await page.click('.engineering-type-card:first-child');
                        console.log('   ✓ 已選擇第一種工程類型');
                    }
                } else {
                    console.log('   ⚠ 沒有找到商機資料');
                }
                
            } else {
                console.log('   ⚠ 沒有找到建立專案按鈕');
                // 嘗試直接訪問建立頁面
                await page.goto('https://construction-management-frontend-dev.pages.dev/project-create.html');
                await page.waitForLoadState('networkidle');
                await page.screenshot({ path: 'screenshots/04-create-direct.png' });
                console.log('   ✓ 直接訪問建立頁面截圖已保存');
            }
            
        } else {
            console.log('   ⚠ 登入可能失敗，當前仍在:', currentUrl);
            
            // 檢查是否有錯誤訊息
            const errorMessage = await page.locator('.error, .alert-error, .alert-danger').textContent().catch(() => null);
            if (errorMessage) {
                console.log('   錯誤訊息:', errorMessage);
            }
        }
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
        await page.screenshot({ path: 'screenshots/error.png' });
        console.log('   ✗ 錯誤截圖已保存');
    } finally {
        // 保持瀏覽器開啟 10 秒鐘讓用戶查看
        console.log('保持瀏覽器開啟 10 秒鐘...');
        await page.waitForTimeout(10000);
        await browser.close();
    }
}

// 執行測試
testNewProject().then(() => {
    console.log('測試完成');
}).catch(error => {
    console.error('測試失敗:', error);
});