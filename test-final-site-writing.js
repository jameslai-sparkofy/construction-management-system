/**
 * 測試修復後的最終案場寫入功能
 */

const { chromium } = require('playwright');

async function testFinalSiteWriting() {
    console.log('🎉 測試修復後的最終案場寫入功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 訊息
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('CONFIG loaded successfully')) {
                console.log('✅ CONFIG 載入成功');
            } else if (text.includes('error') || text.includes('Error')) {
                console.log('⚠️ Console:', text);
            }
        });
        
        // 監聽網路錯誤
        page.on('requestfailed', request => {
            console.log('🌐 Request Failed:', request.url(), request.failure()?.errorText);
        });
        
        // 1. 登入
        console.log('1. 登入開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        if (!page.url().includes('project-list')) {
            throw new Error('登入失敗');
        }
        console.log('✅ 登入成功');
        
        // 2. 進入專案詳情頁面
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 檢查頁面狀態
        console.log('3. 檢查頁面狀態...');
        const pageStatus = await page.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                workerApiUrl: window.CONFIG?.API?.WORKER_API_URL,
                siteElements: document.querySelectorAll('.grid-cell, td[onclick*="openSiteModal"]').length,
                hasError: document.body.textContent.includes('載入專案失敗')
            };
        });
        
        console.log('頁面狀態:', pageStatus);
        
        if (pageStatus.siteElements > 0) {
            console.log('✅ 找到案場，開始測試寫入功能');
            
            // 4. 點擊第一個案場
            console.log('4. 點擊案場開啟 Modal...');
            const siteElements = await page.$$('.grid-cell, td[onclick*="openSiteModal"]');
            if (siteElements.length > 0) {
                await siteElements[0].click();
                await page.waitForTimeout(3000);
                
                // 5. 檢查 Modal 是否開啟
                const modalCheck = await page.evaluate(() => {
                    const modal = document.getElementById('siteModal');
                    return {
                        modalExists: !!modal,
                        modalActive: modal?.classList.contains('active'),
                        currentSiteId: window.currentSiteId
                    };
                });
                
                console.log('Modal 狀態:', modalCheck);
                
                if (modalCheck.modalActive) {
                    console.log('✅ Modal 已開啟');
                    
                    // 6. 填寫測試資料
                    const timestamp = new Date().toLocaleString('zh-TW');
                    const testNote = `CORS 修復測試 - ${timestamp}`;
                    
                    console.log('6. 填寫測試資料...');
                    await page.fill('#notesInput', testNote);
                    console.log(`✅ 已填寫: ${testNote}`);
                    
                    // 7. 監聽結果
                    let alertMessage = null;
                    page.on('dialog', async dialog => {
                        alertMessage = dialog.message();
                        console.log(`📩 Alert: ${alertMessage}`);
                        await dialog.accept();
                    });
                    
                    // 8. 提交
                    console.log('7. 提交案場更新...');
                    const submitButton = await page.$('button.btn-submit');
                    if (submitButton) {
                        await submitButton.click();
                        await page.waitForTimeout(8000);
                        
                        if (alertMessage) {
                            if (alertMessage.includes('成功')) {
                                console.log('🎉 案場寫入成功！');
                                
                                // 9. 驗證結果
                                console.log('8. 驗證寫入結果...');
                                
                                // 關閉 Modal
                                await page.click('.modal-close');
                                await page.waitForTimeout(2000);
                                
                                // 重新打開 Modal 驗證
                                await siteElements[0].click();
                                await page.waitForTimeout(3000);
                                
                                const verifyValue = await page.inputValue('#notesInput');
                                if (verifyValue === testNote) {
                                    console.log('✅ 驗證成功：資料已正確保存');
                                    console.log('🎯 案場寫入功能完全正常！');
                                } else {
                                    console.log(`⚠️ 驗證異常：期望 "${testNote}"，實際 "${verifyValue}"`);
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
                    console.log('❌ Modal 未成功開啟');
                }
            } else {
                console.log('❌ 找不到案場元素');
            }
        } else {
            console.log('❌ 沒有找到案場資料');
        }
        
        // 截圖
        await page.screenshot({ path: 'final-site-writing-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'final-test-error.png', fullPage: true });
    } finally {
        console.log('\n📋 最終案場寫入測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testFinalSiteWriting();