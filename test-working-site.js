/**
 * 測試已知可工作的案場
 */

const { chromium } = require('playwright');

async function testWorkingSite() {
    console.log('🎯 測試已知可工作的案場');
    
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
        
        console.log('✅ 登入成功');
        
        // 2. 直接前往一個帶有案場 ID 的 URL
        console.log('2. 前往帶案場 ID 的 URL...');
        const testUrl = 'https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062&site_id=677633f67f855e00016ff02c';
        await page.goto(testUrl);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 檢查是否自動開啟了 Modal
        const modalCheck = await page.evaluate(() => {
            const modal = document.getElementById('siteModal');
            return {
                modalExists: !!modal,
                modalActive: modal?.classList.contains('active'),
                currentSiteId: window.currentSiteId,
                notesInput: document.getElementById('notesInput')?.value || 'NOT_FOUND'
            };
        });
        
        console.log('Modal 檢查:', modalCheck);
        
        if (modalCheck.modalActive) {
            console.log('✅ 案場 Modal 已自動開啟');
            
            // 4. 檢查認證狀態
            const authCheck = await page.evaluate(() => {
                return {
                    workerApiUrl: window.WORKER_API_URL,
                    apiToken: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
                    tokenPreview: localStorage.getItem('token')?.substring(0, 20) + '...' || 'N/A'
                };
            });
            
            console.log('認證檢查:', authCheck);
            
            // 5. 填寫測試資料
            const timestamp = new Date().toLocaleString('zh-TW');
            const testNote = `最終認證測試 - ${timestamp}`;
            
            console.log('5. 填寫測試資料...');
            await page.fill('#notesInput', testNote);
            console.log(`✅ 已填寫: ${testNote}`);
            
            // 6. 監聽網路請求和回應
            const networkLog = [];
            page.on('request', request => {
                if (request.url().includes('rest/object_8W9cb__c') && request.method() === 'PATCH') {
                    networkLog.push({
                        type: 'request',
                        url: request.url(),
                        method: request.method(),
                        authHeader: request.headers()['authorization']?.substring(0, 30) + '...' || 'MISSING'
                    });
                }
            });
            
            page.on('response', response => {
                if (response.url().includes('rest/object_8W9cb__c') && response.request().method() === 'PATCH') {
                    networkLog.push({
                        type: 'response',
                        url: response.url(),
                        status: response.status(),
                        statusText: response.statusText()
                    });
                }
            });
            
            // 7. 監聽 alert
            let alertMessage = null;
            page.on('dialog', async dialog => {
                alertMessage = dialog.message();
                console.log(`📩 Alert: ${alertMessage}`);
                await dialog.accept();
            });
            
            // 8. 提交
            console.log('6. 提交案場更新...');
            const submitButton = await page.$('button.btn-submit');
            if (submitButton) {
                await submitButton.click();
                await page.waitForTimeout(8000);
                
                console.log('網路日誌:', networkLog);
                
                if (alertMessage) {
                    if (alertMessage.includes('成功')) {
                        console.log('🎉 案場寫入成功！');
                        
                        // 9. 驗證結果
                        console.log('7. 驗證寫入結果...');
                        
                        // 刷新頁面驗證
                        await page.reload();
                        await page.waitForLoadState('networkidle');
                        await page.waitForTimeout(3000);
                        
                        // 重新打開 Modal
                        await page.goto(testUrl);
                        await page.waitForTimeout(5000);
                        
                        const verifyValue = await page.inputValue('#notesInput');
                        if (verifyValue.includes('最終認證測試')) {
                            console.log('✅ 驗證成功：資料已正確保存');
                            console.log('🎯 案場寫入功能完全正常！');
                        } else {
                            console.log(`⚠️ 驗證結果: "${verifyValue}"`);
                        }
                    } else {
                        console.log(`❌ 寫入失敗: ${alertMessage}`);
                    }
                } else {
                    console.log('⚠️ 沒有收到結果訊息');
                }
            } else {
                console.log('❌ 找不到提交按鈕');
            }
        } else {
            console.log('❌ Modal 未自動開啟');
        }
        
        // 截圖
        await page.screenshot({ path: 'working-site-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'working-site-error.png', fullPage: true });
    } finally {
        console.log('\n📋 已知案場測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testWorkingSite();