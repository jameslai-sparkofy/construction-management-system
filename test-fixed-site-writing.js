/**
 * 測試修復後的案場寫入功能
 */

const { chromium } = require('playwright');

async function testFixedSiteWriting() {
    console.log('🎉 測試修復後的案場寫入功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 來確認 CONFIG 載入
        page.on('console', msg => {
            if (msg.text().includes('CONFIG loaded successfully')) {
                console.log('✅ CONFIG 載入成功確認');
            } else if (msg.text().includes('Environment:')) {
                console.log('🔧 環境信息:', msg.text());
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
        
        if (!page.url().includes('project-list')) {
            throw new Error('登入失敗');
        }
        
        console.log('✅ 登入成功');
        
        // 2. 進入專案詳情頁面（使用已知存在的專案 ID）
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        
        // 3. 等待頁面載入並檢查 CONFIG
        console.log('3. 檢查 CONFIG 載入狀態...');
        await page.waitForTimeout(5000);
        
        const configCheck = await page.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                workerApiUrl: window.CONFIG?.API?.WORKER_API_URL || 'NOT_FOUND',
                environment: window.CONFIG?.ENVIRONMENT || 'UNKNOWN'
            };
        });
        
        console.log('CONFIG 檢查:', configCheck);
        
        if (!configCheck.configExists) {
            throw new Error('CONFIG 仍然沒有載入');
        }
        
        // 4. 等待專案資料載入
        console.log('4. 等待專案資料載入...');
        await page.waitForTimeout(8000);
        
        // 檢查是否有載入錯誤
        const hasError = await page.evaluate(() => 
            document.body.textContent.includes('載入專案失敗') ||
            document.body.textContent.includes('HTTP 404')
        );
        
        if (hasError) {
            console.log('❌ 專案載入仍有錯誤');
            await page.screenshot({ path: 'project-load-error.png', fullPage: true });
        } else {
            console.log('✅ 專案載入成功');
            
            // 5. 尋找並點擊案場
            console.log('5. 尋找案場元素...');
            
            const siteElement = await page.$('.grid-cell, td[onclick*="openSiteModal"]');
            if (siteElement) {
                console.log('✅ 找到案場元素');
                
                await siteElement.click();
                await page.waitForTimeout(3000);
                
                // 檢查 Modal 是否打開
                const modalActive = await page.$('#siteModal.active');
                if (modalActive) {
                    console.log('✅ 案場 Modal 已打開');
                    
                    // 6. 測試案場資料寫入
                    console.log('6. 測試案場資料寫入...');
                    
                    const timestamp = new Date().toLocaleString('zh-TW');
                    const testNote = `修復後測試 - ${timestamp}`;
                    
                    const notesInput = await page.$('#notesInput');
                    if (notesInput) {
                        await page.fill('#notesInput', testNote);
                        console.log(`✅ 已填寫施工前備註: ${testNote}`);
                        
                        // 監聽提交結果
                        let submitResult = null;
                        page.on('dialog', async dialog => {
                            submitResult = dialog.message();
                            console.log(`📩 收到提交結果: ${submitResult}`);
                            await dialog.accept();
                        });
                        
                        // 提交更新
                        console.log('7. 提交案場更新...');
                        const submitButton = await page.$('button.btn-submit');
                        if (submitButton) {
                            await submitButton.click();
                            
                            // 等待響應
                            await page.waitForTimeout(8000);
                            
                            if (submitResult) {
                                if (submitResult.includes('成功')) {
                                    console.log('🎉 案場資料寫入測試成功！');
                                    
                                    // 8. 驗證寫入結果
                                    console.log('8. 驗證寫入結果...');
                                    
                                    // 關閉並重新打開 Modal 驗證
                                    await page.click('.modal-close');
                                    await page.waitForTimeout(2000);
                                    
                                    await siteElement.click();
                                    await page.waitForTimeout(3000);
                                    
                                    const verifyNotes = await page.inputValue('#notesInput');
                                    if (verifyNotes === testNote) {
                                        console.log('✅ 驗證成功：資料已正確保存');
                                        console.log('🎯 案場寫入功能完全正常！');
                                    } else {
                                        console.log(`⚠️ 驗證異常：期望 "${testNote}"，實際 "${verifyNotes}"`);
                                    }
                                    
                                } else {
                                    console.log(`❌ 寫入失敗: ${submitResult}`);
                                }
                            } else {
                                console.log('⚠️ 沒有收到提交結果回應');
                            }
                        } else {
                            console.log('❌ 找不到提交按鈕');
                        }
                    } else {
                        console.log('❌ 找不到施工前備註輸入框');
                    }
                } else {
                    console.log('❌ 案場 Modal 未成功打開');
                }
            } else {
                console.log('❌ 沒有找到案場元素');
            }
        }
        
        // 最終截圖
        await page.screenshot({ path: 'fixed-site-writing-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'fixed-test-error.png', fullPage: true });
    } finally {
        console.log('\n📋 修復測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testFixedSiteWriting();