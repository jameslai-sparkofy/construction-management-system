/**
 * 測試修復後的案場載入功能
 */

const { chromium } = require('playwright');

async function testFixedSiteLoading() {
    console.log('🎯 測試修復後的案場載入功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 錯誤
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('🚨 Console Error:', msg.text());
            } else if (msg.text().includes('CONFIG loaded successfully')) {
                console.log('✅ CONFIG 載入成功');
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
        await page.waitForTimeout(8000);
        
        // 3. 檢查 token 設置
        console.log('3. 檢查 token 設置...');
        const tokenCheck = await page.evaluate(() => {
            return {
                jwtToken: typeof window.JWT_TOKEN !== 'undefined' ? 'DEFINED' : 'UNDEFINED',
                crmToken: typeof window.CRM_TOKEN !== 'undefined' ? 'DEFINED' : 'UNDEFINED',
                apiToken: typeof window.API_TOKEN !== 'undefined' ? 'DEFINED' : 'UNDEFINED',
                jwtPreview: window.JWT_TOKEN?.substring(0, 20) + '...' || 'N/A',
                crmPreview: window.CRM_TOKEN?.substring(0, 20) + '...' || 'N/A'
            };
        });
        
        console.log('Token 檢查:', tokenCheck);
        
        // 4. 檢查案場載入狀態
        console.log('4. 檢查案場載入狀態...');
        const siteLoadingCheck = await page.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                apiUrl: window.CONFIG?.API?.WORKER_API_URL,
                crmUrl: window.CONFIG?.API?.CRM_API_URL,
                siteElements: document.querySelectorAll('.grid-cell, td[onclick*="openSiteModal"]').length,
                hasError: document.body.textContent.includes('載入專案失敗'),
                bodyPreview: document.body.textContent.substring(0, 300)
            };
        });
        
        console.log('案場載入檢查:', siteLoadingCheck);
        
        // 5. 如果仍然沒有案場，手動測試 API 呼叫
        if (siteLoadingCheck.siteElements === 0) {
            console.log('5. 手動測試 CRM API 呼叫...');
            
            const manualApiTest = await page.evaluate(async () => {
                try {
                    // 測試專案資料載入
                    const projectId = 'proj_1755783317062';
                    const token = localStorage.getItem('token');
                    const workerApiUrl = window.CONFIG?.API?.WORKER_API_URL;
                    
                    const projectResponse = await fetch(`${workerApiUrl}/api/v1/projects/${projectId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const projectData = await projectResponse.json();
                    const opportunityId = projectData.project?.opportunity_id;
                    
                    console.log('專案資料:', {
                        success: projectResponse.ok,
                        opportunityId: opportunityId
                    });
                    
                    if (opportunityId) {
                        // 測試案場資料載入
                        const crmApiUrl = window.CONFIG?.API?.CRM_API_URL || 'https://d1.yes-ceramics.com';
                        const crmToken = window.CRM_TOKEN;
                        
                        const sitesResponse = await fetch(`${crmApiUrl}/rest/object_8W9cb__c?field_1P96q__c=${opportunityId}&limit=10`, {
                            headers: {
                                'Authorization': `Bearer ${crmToken}`
                            }
                        });
                        
                        const sitesData = await sitesResponse.json();
                        
                        return {
                            projectSuccess: projectResponse.ok,
                            opportunityId: opportunityId,
                            sitesSuccess: sitesResponse.ok,
                            sitesCount: sitesData.results?.length || 0,
                            sitesStatus: sitesResponse.status,
                            usedCrmUrl: crmApiUrl,
                            usedCrmToken: crmToken?.substring(0, 20) + '...' || 'N/A'
                        };
                    }
                    
                    return {
                        projectSuccess: projectResponse.ok,
                        opportunityId: null,
                        error: 'No opportunity_id found'
                    };
                    
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            console.log('手動 API 測試結果:', manualApiTest);
            
            if (manualApiTest.projectSuccess && manualApiTest.sitesCount > 0) {
                console.log('🎉 API 正常！案場資料存在但頁面未顯示');
                console.log('建議：檢查前端顯示邏輯');
            } else if (manualApiTest.sitesCount === 0) {
                console.log('⚠️ 確認：這個專案確實沒有案場資料');
                console.log(`Opportunity ID: ${manualApiTest.opportunityId}`);
            }
        } else {
            console.log('🎉 案場載入成功！');
            
            // 6. 測試案場點擊和寫入功能
            console.log('6. 測試案場點擊...');
            const siteElements = await page.$$('.grid-cell, td[onclick*="openSiteModal"]');
            if (siteElements.length > 0) {
                await siteElements[0].click();
                await page.waitForTimeout(3000);
                
                const modalCheck = await page.evaluate(() => {
                    const modal = document.getElementById('siteModal');
                    return {
                        modalActive: modal?.classList.contains('active'),
                        currentSiteId: window.currentSiteId,
                        notesInput: document.getElementById('notesInput')?.value || 'NOT_FOUND'
                    };
                });
                
                console.log('Modal 檢查:', modalCheck);
                
                if (modalCheck.modalActive) {
                    // 測試寫入功能
                    const timestamp = new Date().toLocaleString('zh-TW');
                    const testNote = `Token 修復測試 - ${timestamp}`;
                    
                    await page.fill('#notesInput', testNote);
                    console.log(`✅ 已填寫測試資料: ${testNote}`);
                    
                    // 監聽提交結果
                    let alertMessage = null;
                    page.on('dialog', async dialog => {
                        alertMessage = dialog.message();
                        console.log(`📩 提交結果: ${alertMessage}`);
                        await dialog.accept();
                    });
                    
                    const submitButton = await page.$('button.btn-submit');
                    if (submitButton) {
                        await submitButton.click();
                        await page.waitForTimeout(5000);
                        
                        if (alertMessage && alertMessage.includes('成功')) {
                            console.log('🎉 完整功能測試成功！');
                        } else {
                            console.log('❌ 寫入功能仍有問題:', alertMessage);
                        }
                    }
                }
            }
        }
        
        // 截圖
        await page.screenshot({ path: 'fixed-site-loading-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'fixed-site-loading-error.png', fullPage: true });
    } finally {
        console.log('\n📋 修復測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testFixedSiteLoading();