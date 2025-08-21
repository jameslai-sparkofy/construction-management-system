/**
 * 手動觸發 Modal 測試
 */

const { chromium } = require('playwright');

async function testManualModal() {
    console.log('🛠️ 手動觸發 Modal 測試');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 1. 登入
        console.log('1. 登入開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 2. 前往專案詳情頁面
        console.log('2. 前往專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(8000);
        
        // 3. 檢查頁面狀態
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                bodyText: document.body.textContent.substring(0, 300),
                tableRows: document.querySelectorAll('table tbody tr').length,
                gridCells: document.querySelectorAll('.grid-cell').length,
                onclickElements: document.querySelectorAll('[onclick*="openSiteModal"]').length
            };
        });
        
        console.log('頁面資訊:', pageInfo);
        
        // 4. 手動呼叫 openSiteModal 函數
        console.log('4. 手動呼叫 openSiteModal...');
        
        const manualModalResult = await page.evaluate(() => {
            try {
                // 檢查函數是否存在
                if (typeof window.openSiteModal !== 'function') {
                    return { success: false, error: 'openSiteModal function not found' };
                }
                
                // 嘗試用已知的案場 ID 開啟 Modal
                const testSiteId = '677633f67f855e00016ff02c';
                window.openSiteModal(testSiteId);
                
                // 檢查 Modal 狀態
                const modal = document.getElementById('siteModal');
                return {
                    success: true,
                    modalActive: modal?.classList.contains('active'),
                    currentSiteId: window.currentSiteId,
                    notesInputExists: !!document.getElementById('notesInput')
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('手動 Modal 結果:', manualModalResult);
        
        if (manualModalResult.success && manualModalResult.modalActive) {
            console.log('✅ Modal 已手動開啟');
            
            // 5. 測試寫入功能
            const timestamp = new Date().toLocaleString('zh-TW');
            const testNote = `手動 Modal 測試 - ${timestamp}`;
            
            console.log('5. 填寫測試資料...');
            await page.fill('#notesInput', testNote);
            console.log(`✅ 已填寫: ${testNote}`);
            
            // 6. 檢查變數狀態
            const variableCheck = await page.evaluate(() => {
                return {
                    currentSiteId: window.currentSiteId,
                    workerApiUrl: window.WORKER_API_URL,
                    configUrl: window.CONFIG?.API?.WORKER_API_URL,
                    apiToken: localStorage.getItem('token') ? 'EXISTS' : 'MISSING'
                };
            });
            
            console.log('變數檢查:', variableCheck);
            
            // 7. 監聽網路活動
            const networkActivity = [];
            page.on('request', request => {
                if (request.url().includes('api') || request.url().includes('rest')) {
                    networkActivity.push({
                        type: 'request',
                        method: request.method(),
                        url: request.url().substring(0, 100) + '...',
                        hasAuth: !!request.headers()['authorization']
                    });
                }
            });
            
            page.on('response', response => {
                if (response.url().includes('api') || response.url().includes('rest')) {
                    networkActivity.push({
                        type: 'response',
                        status: response.status(),
                        url: response.url().substring(0, 100) + '...'
                    });
                }
            });
            
            // 8. 監聽 Alert
            let alertMessage = null;
            page.on('dialog', async dialog => {
                alertMessage = dialog.message();
                console.log(`📩 Alert: ${alertMessage}`);
                await dialog.accept();
            });
            
            // 9. 提交
            console.log('6. 提交...');
            const submitButton = await page.$('button.btn-submit');
            if (submitButton) {
                await submitButton.click();
                await page.waitForTimeout(10000);
                
                console.log('網路活動:', networkActivity);
                
                if (alertMessage) {
                    if (alertMessage.includes('成功')) {
                        console.log('🎉 手動 Modal 測試成功！');
                    } else {
                        console.log(`❌ 失敗: ${alertMessage}`);
                    }
                } else {
                    console.log('⚠️ 沒有收到 Alert 訊息');
                }
            } else {
                console.log('❌ 找不到提交按鈕');
            }
        } else {
            console.log('❌ 手動開啟 Modal 失敗');
        }
        
        // 截圖
        await page.screenshot({ path: 'manual-modal-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'manual-modal-error.png', fullPage: true });
    } finally {
        console.log('\n📋 手動 Modal 測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testManualModal();