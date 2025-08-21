/**
 * 測試實際案場寫入功能 - 使用開發環境
 */

const { chromium } = require('playwright');

async function testLiveSiteWriting() {
    console.log('🏗️ 測試實際案場寫入功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 2000  // 放慢操作以便觀察
    });
    const page = await browser.newPage();
    
    try {
        // 1. 登入開發環境
        console.log('1. 登入開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        
        await page.waitForTimeout(3000);
        console.log('✅ 登入完成');
        
        // 2. 檢查是否成功跳轉到專案列表
        if (!page.url().includes('project-list')) {
            throw new Error('登入失敗，未跳轉到專案列表');
        }
        
        // 3. 點擊第一個專案
        console.log('2. 選擇專案進入詳情頁面...');
        await page.waitForSelector('.project-card', { timeout: 10000 });
        
        const firstProject = await page.$('.project-card');
        if (!firstProject) {
            throw new Error('沒有找到任何專案');
        }
        
        await firstProject.click();
        await page.waitForTimeout(3000);
        
        console.log('✅ 進入專案詳情頁面:', page.url());
        
        // 4. 等待案場資料載入
        console.log('3. 等待案場資料載入...');
        await page.waitForSelector('.grid-cell', { timeout: 15000 });
        
        // 5. 找到第一個案場並點擊
        console.log('4. 選擇案場進行測試...');
        const firstSite = await page.$('.grid-cell');
        if (!firstSite) {
            throw new Error('沒有找到任何案場');
        }
        
        await firstSite.click();
        await page.waitForTimeout(2000);
        
        // 6. 等待案場 Modal 打開
        await page.waitForSelector('#siteModal.active', { timeout: 10000 });
        console.log('✅ 案場 Modal 已打開');
        
        // 7. 填寫施工前備註
        console.log('5. 填寫施工前備註...');
        const timestamp = new Date().toLocaleString('zh-TW');
        const testNote = `自動化測試 - ${timestamp}`;
        
        await page.fill('#notesInput', testNote);
        console.log(`✅ 已填寫備註: ${testNote}`);
        
        // 8. 檢查是否有完工核取方塊，如果沒有勾選則進行基本更新
        const completionCheck = await page.$('#completionCheck');
        const isCompleted = await completionCheck?.isChecked();
        
        if (!isCompleted) {
            console.log('6. 案場尚未完工，進行基本資訊更新...');
        } else {
            console.log('6. 案場已完工，更新完工資訊...');
            
            // 如果已完工，可以更新完工相關資訊
            const areaInput = await page.$('#areaInput');
            if (areaInput) {
                await areaInput.fill('15.5');
                console.log('✅ 已更新鋪設坪數: 15.5');
            }
            
            const workerInput = await page.$('#workerInput');
            if (workerInput) {
                await workerInput.fill('測試師父');
                console.log('✅ 已更新工班師父: 測試師父');
            }
        }
        
        // 9. 提交更新
        console.log('7. 提交案場更新...');
        await page.click('button.btn-submit');
        
        // 10. 等待提交結果
        console.log('8. 等待提交結果...');
        
        // 監聽可能的 alert
        let alertMessage = null;
        page.on('dialog', async dialog => {
            alertMessage = dialog.message();
            console.log(`收到 Alert: ${alertMessage}`);
            await dialog.accept();
        });
        
        await page.waitForTimeout(5000);
        
        if (alertMessage) {
            if (alertMessage.includes('成功')) {
                console.log('✅ 案場更新成功！');
                
                // 11. 驗證更新結果
                console.log('9. 驗證更新結果...');
                
                // 重新打開同一個案場檢查
                await page.waitForTimeout(2000);
                await firstSite.click();
                await page.waitForSelector('#siteModal.active', { timeout: 10000 });
                
                const notesValue = await page.inputValue('#notesInput');
                if (notesValue === testNote) {
                    console.log('✅ 驗證成功：施工前備註已正確保存');
                } else {
                    console.log(`⚠️ 驗證異常：期望 "${testNote}"，實際 "${notesValue}"`);
                }
                
            } else {
                console.log('❌ 案場更新失敗:', alertMessage);
            }
        } else {
            console.log('⚠️ 沒有收到提交結果 Alert，檢查網路請求...');
            
            // 檢查網路請求是否有錯誤
            const responses = await page.evaluate(() => {
                return window.performance.getEntriesByType('navigation').map(entry => ({
                    url: entry.name,
                    status: entry.responseStatus
                }));
            });
            console.log('網路請求狀態:', responses);
        }
        
        // 12. 截圖記錄
        await page.screenshot({ path: 'site-update-test-result.png', fullPage: true });
        console.log('✅ 測試結果截圖已保存: site-update-test-result.png');
        
        console.log('\n📋 測試總結:');
        console.log('- 登入: ✅');
        console.log('- 專案選擇: ✅');
        console.log('- 案場載入: ✅');
        console.log('- Modal 開啟: ✅');
        console.log('- 資料填寫: ✅');
        console.log(`- 提交結果: ${alertMessage ? '✅' : '⚠️'}`);
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'site-update-test-error.png', fullPage: true });
    } finally {
        console.log('\n瀏覽器將保持開啟 30 秒供檢查...');
        setTimeout(() => browser.close(), 30000);
    }
}

testLiveSiteWriting();