/**
 * 調試 PATCH 請求的詳細內容
 */

const { chromium } = require('playwright');

async function debugPatchRequest() {
    console.log('🔍 調試 PATCH 請求');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 監聽所有網路請求
        const networkRequests = [];
        page.on('request', request => {
            if (request.url().includes('rest/object_8W9cb__c') && request.method() === 'PATCH') {
                networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    headers: request.headers(),
                    postData: request.postData()
                });
                console.log('🌐 PATCH 請求:', {
                    url: request.url(),
                    method: request.method(),
                    headers: Object.keys(request.headers()),
                    postData: request.postData()
                });
            }
        });
        
        // 監聽回應
        page.on('response', response => {
            if (response.url().includes('rest/object_8W9cb__c') && response.request().method() === 'PATCH') {
                console.log('📡 PATCH 回應:', {
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText()
                });
                
                // 嘗試獲取回應內容
                response.text().then(text => {
                    console.log('📄 回應內容:', text);
                }).catch(err => {
                    console.log('⚠️ 無法讀取回應內容:', err.message);
                });
            }
        });
        
        // 1. 登入
        console.log('1. 登入開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 2. 進入專案詳情頁面
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 檢查認證 token
        const authCheck = await page.evaluate(() => {
            return {
                token: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
                tokenLength: localStorage.getItem('token')?.length || 0
            };
        });
        console.log('認證檢查:', authCheck);
        
        // 4. 點擊案場
        console.log('4. 點擊案場...');
        const siteElements = await page.$$('.grid-cell, td[onclick*="openSiteModal"]');
        if (siteElements.length > 0) {
            await siteElements[0].click();
            await page.waitForTimeout(3000);
            
            // 5. 檢查 currentSiteId
            const siteIdCheck = await page.evaluate(() => {
                return {
                    currentSiteId: window.currentSiteId,
                    workerApiUrl: window.WORKER_API_URL,
                    apiToken: window.API_TOKEN ? 'EXISTS' : 'MISSING'
                };
            });
            console.log('案場 ID 檢查:', siteIdCheck);
            
            // 6. 填寫並提交
            console.log('6. 填寫並提交...');
            await page.fill('#notesInput', 'Debug PATCH 測試');
            
            const submitButton = await page.$('button.btn-submit');
            if (submitButton) {
                await submitButton.click();
                await page.waitForTimeout(8000);
                
                console.log('捕獲的 PATCH 請求:', networkRequests);
            }
        }
        
        await page.screenshot({ path: 'debug-patch-request.png', fullPage: true });
        
    } catch (error) {
        console.error('❌ 調試錯誤:', error);
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

debugPatchRequest();