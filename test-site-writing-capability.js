/**
 * 測試案場寫入能力
 */

const { chromium } = require('playwright');

async function testSiteWritingCapability() {
    console.log('🎯 測試案場寫入能力');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
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
        
        // 2. 進入專案詳情頁面
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        
        // 3. 檢查 CONFIG 載入狀態
        console.log('3. 檢查 CONFIG 載入狀態...');
        await page.waitForTimeout(3000);
        
        const configCheck = await page.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                workerApiUrl: window.CONFIG?.API?.WORKER_API_URL || 'NOT_FOUND',
                environment: window.CONFIG?.ENVIRONMENT || 'UNKNOWN'
            };
        });
        
        console.log('CONFIG 檢查:', configCheck);
        
        // 4. 等待專案資料載入，檢查是否有案場
        console.log('4. 等待並檢查案場資料...');
        await page.waitForTimeout(8000);
        
        // 檢查頁面內容
        const pageContent = await page.evaluate(() => {
            return {
                hasError: document.body.textContent.includes('載入專案失敗') ||
                         document.body.textContent.includes('HTTP 404'),
                siteElements: document.querySelectorAll('.grid-cell, td[onclick*="openSiteModal"]').length,
                tableRows: document.querySelectorAll('table tbody tr').length,
                bodyText: document.body.textContent.substring(0, 500)
            };
        });
        
        console.log('頁面內容檢查:', pageContent);
        
        if (pageContent.hasError) {
            console.log('❌ 專案載入有錯誤，嘗試直接測試 API...');
            
            // 直接測試 Worker API
            const apiTest = await page.evaluate(async () => {
                try {
                    const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/api/v1/projects/proj_1755783317062`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    
                    return {
                        success: response.ok,
                        status: response.status,
                        dataKeys: Object.keys(data),
                        sitesCount: data.sites?.length || 0
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            console.log('直接 API 測試:', apiTest);
            
            if (apiTest.success && apiTest.sitesCount > 0) {
                console.log('✅ API 回應正常，有案場資料');
                
                // 測試寫入功能 - 直接用 API
                console.log('5. 直接測試案場寫入 API...');
                
                const writeTest = await page.evaluate(async () => {
                    try {
                        // 獲取第一個案場 ID
                        const projectResponse = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/api/v1/projects/proj_1755783317062`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const projectData = await projectResponse.json();
                        const siteId = projectData.sites?.[0]?.id;
                        
                        if (!siteId) {
                            return { success: false, error: 'No site ID found' };
                        }
                        
                        console.log('Using site ID:', siteId);
                        
                        // 準備測試資料
                        const timestamp = new Date().toLocaleString('zh-TW');
                        const testData = {
                            field_sF6fn__c: `API 寫入測試 - ${timestamp}`  // 施工前備註
                        };
                        
                        // 執行寫入
                        const updateResponse = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/rest/object_8W9cb__c/${siteId}`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(testData)
                        });
                        
                        const updateResult = await updateResponse.json();
                        
                        return {
                            success: updateResponse.ok,
                            status: updateResponse.status,
                            siteId: siteId,
                            testData: testData,
                            result: updateResult
                        };
                        
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                });
                
                console.log('寫入測試結果:', writeTest);
                
                if (writeTest.success) {
                    console.log('🎉 案場寫入測試成功！');
                    
                    // 驗證寫入結果
                    console.log('6. 驗證寫入結果...');
                    
                    const verifyTest = await page.evaluate(async () => {
                        try {
                            const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/api/v1/projects/proj_1755783317062`, {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            const data = await response.json();
                            const site = data.sites?.find(s => s.id === writeTest.siteId);
                            
                            return {
                                success: true,
                                beforeNotes: site?.field_sF6fn__c,
                                matchesTest: site?.field_sF6fn__c === writeTest.testData.field_sF6fn__c
                            };
                        } catch (error) {
                            return {
                                success: false,
                                error: error.message
                            };
                        }
                    });
                    
                    console.log('驗證結果:', verifyTest);
                    
                    if (verifyTest.matchesTest) {
                        console.log('✅ 完整測試成功：案場寫入功能正常運作！');
                    } else {
                        console.log('⚠️ 寫入成功但驗證不符');
                    }
                } else {
                    console.log('❌ 案場寫入失敗:', writeTest);
                }
            } else {
                console.log('❌ API 測試失敗或無案場資料');
            }
            
        } else if (pageContent.siteElements > 0) {
            console.log('✅ 頁面載入正常，找到案場元素');
            
            // 使用頁面 UI 測試寫入功能
            console.log('5. 透過 UI 測試案場寫入...');
            
            const siteElement = await page.$('.grid-cell, td[onclick*="openSiteModal"]');
            if (siteElement) {
                await siteElement.click();
                await page.waitForTimeout(3000);
                
                const modalActive = await page.$('#siteModal.active');
                if (modalActive) {
                    console.log('✅ 案場 Modal 已打開');
                    
                    const timestamp = new Date().toLocaleString('zh-TW');
                    const testNote = `UI 寫入測試 - ${timestamp}`;
                    
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
                        
                        const submitButton = await page.$('button.btn-submit');
                        if (submitButton) {
                            await submitButton.click();
                            await page.waitForTimeout(5000);
                            
                            if (submitResult && submitResult.includes('成功')) {
                                console.log('🎉 UI 案場寫入測試成功！');
                            } else {
                                console.log('❌ UI 寫入失敗:', submitResult);
                            }
                        }
                    }
                }
            }
        } else {
            console.log('⚠️ 頁面載入正常但未找到案場元素');
        }
        
        // 截圖
        await page.screenshot({ path: 'site-writing-capability-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'site-writing-error.png', fullPage: true });
    } finally {
        console.log('\n📋 案場寫入能力測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testSiteWritingCapability();