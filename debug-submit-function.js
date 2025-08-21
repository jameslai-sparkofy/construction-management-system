/**
 * 調試提交功能問題
 */

const { chromium } = require('playwright');

async function debugSubmitFunction() {
    console.log('🔍 調試提交功能問題');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
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
        
        // 2. 進入專案詳情頁面
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 檢查關鍵變數
        console.log('3. 檢查關鍵變數...');
        
        const variableCheck = await page.evaluate(() => {
            return {
                // CONFIG 檢查
                configExists: typeof window.CONFIG !== 'undefined',
                configApi: window.CONFIG?.API || null,
                
                // WORKER_API_URL 檢查
                workerApiUrl: typeof window.WORKER_API_URL !== 'undefined' ? window.WORKER_API_URL : 'UNDEFINED',
                
                // API_TOKEN 檢查  
                apiToken: typeof window.API_TOKEN !== 'undefined' ? (window.API_TOKEN ? 'DEFINED' : 'EMPTY') : 'UNDEFINED',
                
                // submitForm 函數檢查
                submitFormExists: typeof window.submitForm === 'function',
                
                // 全域變數檢查
                globalVars: {
                    currentSiteId: typeof window.currentSiteId !== 'undefined' ? window.currentSiteId : 'UNDEFINED',
                    fieldMapping: typeof window.fieldMapping !== 'undefined' ? 'DEFINED' : 'UNDEFINED'
                }
            };
        });
        
        console.log('變數檢查結果:', JSON.stringify(variableCheck, null, 2));
        
        // 4. 嘗試點擊案場並檢查 Modal
        console.log('4. 嘗試點擊案場...');
        
        // 尋找案場元素
        const siteElements = await page.$$('.grid-cell, td[onclick*="openSiteModal"]');
        console.log(`找到 ${siteElements.length} 個案場元素`);
        
        if (siteElements.length > 0) {
            // 點擊第一個案場
            await siteElements[0].click();
            await page.waitForTimeout(3000);
            
            // 檢查 Modal 是否打開
            const modalCheck = await page.evaluate(() => {
                const modal = document.getElementById('siteModal');
                const submitButton = document.querySelector('button.btn-submit');
                
                return {
                    modalExists: !!modal,
                    modalActive: modal?.classList.contains('active'),
                    submitButtonExists: !!submitButton,
                    submitButtonOnclick: submitButton?.getAttribute('onclick'),
                    currentSiteId: window.currentSiteId,
                    // 檢查實際的 API URL 值
                    actualWorkerApiUrl: window.WORKER_API_URL,
                    actualApiToken: window.API_TOKEN ? 'HAS_TOKEN' : 'NO_TOKEN'
                };
            });
            
            console.log('Modal 檢查:', modalCheck);
            
            if (modalCheck.modalActive && modalCheck.submitButtonExists) {
                console.log('5. 測試提交按鈕點擊...');
                
                // 填寫一些測試資料
                await page.fill('#notesInput', '測試提交功能');
                
                // 監聽 console 錯誤
                const consoleErrors = [];
                page.on('console', msg => {
                    if (msg.type() === 'error') {
                        consoleErrors.push(msg.text());
                    }
                });
                
                // 監聽網路請求
                const networkRequests = [];
                page.on('request', request => {
                    if (request.url().includes('api')) {
                        networkRequests.push({
                            url: request.url(),
                            method: request.method()
                        });
                    }
                });
                
                // 點擊提交按鈕
                const submitButton = await page.$('button.btn-submit');
                if (submitButton) {
                    await submitButton.click();
                    await page.waitForTimeout(5000);
                    
                    console.log('Console 錯誤:', consoleErrors);
                    console.log('網路請求:', networkRequests);
                    
                    // 檢查是否有 alert 或錯誤訊息
                    const finalCheck = await page.evaluate(() => {
                        return {
                            pageTitle: document.title,
                            modalStillOpen: document.getElementById('siteModal')?.classList.contains('active'),
                            anyDialogs: document.querySelectorAll('[role="dialog"]').length
                        };
                    });
                    
                    console.log('最終檢查:', finalCheck);
                } else {
                    console.log('❌ 找不到提交按鈕');
                }
            } else {
                console.log('❌ Modal 未正確打開或按鈕不存在');
            }
        } else {
            console.log('❌ 沒有找到案場元素');
        }
        
        // 截圖
        await page.screenshot({ path: 'debug-submit-function.png', fullPage: true });
        console.log('✅ 調試截圖已保存');
        
    } catch (error) {
        console.error('❌ 調試過程錯誤:', error);
        await page.screenshot({ path: 'debug-submit-error.png', fullPage: true });
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

debugSubmitFunction();