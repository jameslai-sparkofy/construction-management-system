/**
 * 測試 Worker API 的 D1 案場寫入能力
 */

const { chromium } = require('playwright');

async function testWorkerApiSiteUpdate() {
    console.log('🧪 測試 Worker API 的 D1 案場寫入能力');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        // 1. 先登入獲取認證 token
        console.log('1. 登入系統獲取 token...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        const phoneInput = await page.$('input[type="tel"], input[name="phone"], #phone');
        const passwordInput = await page.$('input[type="password"], input[name="password"], #password');
        const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("登入")');
        
        if (phoneInput && passwordInput && submitButton) {
            await phoneInput.fill('0912345678');
            await passwordInput.fill('678');
            await submitButton.click();
            await page.waitForTimeout(3000);
        }
        
        // 2. 獲取 token
        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        console.log('Token 存在:', !!token);
        
        if (!token) {
            console.error('❌ 無法獲取認證 token');
            return;
        }
        
        // 3. 獲取配置
        const config = await page.evaluate(() => window.CONFIG);
        console.log('CONFIG 存在:', !!config);
        
        const workerApiUrl = config?.API?.WORKER_API_URL || 'https://construction-management-api-dev.lai-jameslai.workers.dev';
        console.log('Worker API URL:', workerApiUrl);
        
        // 4. 測試讀取案場資料（先找一個存在的案場）
        console.log('2. 測試讀取案場資料...');
        
        const testSiteId = '677633f67f855e00016ff02c'; // 從 URL 取得的案場 ID
        const readResponse = await page.evaluate(async (apiUrl, siteId, authToken) => {
            try {
                const response = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?_id=${siteId}`, {
                    headers: {
                        'Authorization': 'Bearer fx-crm-api-secret-2025'
                    }
                });
                
                const data = await response.json();
                return {
                    success: response.ok,
                    status: response.status,
                    data: data,
                    url: `https://d1.yes-ceramics.com/rest/object_8W9cb__c?_id=${siteId}`
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, workerApiUrl, testSiteId, token);
        
        console.log('讀取結果:', readResponse);
        
        if (!readResponse.success || !readResponse.data?.results?.length) {
            console.error('❌ 無法找到測試案場，嘗試查詢所有案場...');
            
            // 嘗試獲取其他案場
            const allSitesResponse = await page.evaluate(async () => {
                try {
                    const response = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?limit=5`, {
                        headers: {
                            'Authorization': 'Bearer fx-crm-api-secret-2025'
                        }
                    });
                    
                    const data = await response.json();
                    return {
                        success: response.ok,
                        data: data,
                        count: data.results?.length || 0
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            console.log('所有案場查詢:', allSitesResponse);
            
            if (allSitesResponse.success && allSitesResponse.data?.results?.length > 0) {
                const firstSite = allSitesResponse.data.results[0];
                console.log('使用第一個案場進行測試:', firstSite._id);
                testSiteId = firstSite._id;
            } else {
                console.error('❌ 無法找到任何案場進行測試');
                return;
            }
        }
        
        const siteData = readResponse.data?.results?.[0] || readResponse.data;
        console.log('案場資料:', {
            id: siteData?._id,
            building: siteData?.Building__c,
            floor: siteData?.Floor__c,
            unit: siteData?.unit__c,
            completed: siteData?.field_completed__c
        });
        
        // 5. 測試寫入功能
        console.log('3. 測試 Worker API 寫入功能...');
        
        const updateData = {
            field_before_notes__c: `測試更新 - ${new Date().toLocaleString()}`,
            field_completed__c: false, // 測試更新完成狀態
            // 添加一些測試欄位
            area__c: '12.5',
            construction_date__c: '2025-08-21'
        };
        
        const updateResponse = await page.evaluate(async (apiUrl, siteId, authToken, data) => {
            try {
                const response = await fetch(`${apiUrl}/rest/object_8W9cb__c/${siteId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                let responseData;
                try {
                    responseData = await response.json();
                } catch (e) {
                    responseData = { text: await response.text() };
                }
                
                return {
                    success: response.ok,
                    status: response.status,
                    data: responseData,
                    url: `${apiUrl}/rest/object_8W9cb__c/${siteId}`
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, workerApiUrl, testSiteId, token, updateData);
        
        console.log('更新結果:', updateResponse);
        
        // 6. 驗證更新是否成功
        if (updateResponse.success) {
            console.log('✅ Worker API 寫入成功！');
            
            // 重新讀取驗證
            console.log('4. 驗證更新結果...');
            
            await page.waitForTimeout(2000); // 等待 D1 同步
            
            const verifyResponse = await page.evaluate(async (siteId) => {
                try {
                    const response = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?_id=${siteId}`, {
                        headers: {
                            'Authorization': 'Bearer fx-crm-api-secret-2025'
                        }
                    });
                    
                    const data = await response.json();
                    return {
                        success: response.ok,
                        data: data.results?.[0] || data
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }, testSiteId);
            
            if (verifyResponse.success) {
                console.log('驗證結果:', {
                    beforeNotes: verifyResponse.data?.field_before_notes__c,
                    completed: verifyResponse.data?.field_completed__c,
                    area: verifyResponse.data?.area__c,
                    date: verifyResponse.data?.construction_date__c
                });
                
                if (verifyResponse.data?.field_before_notes__c?.includes('測試更新')) {
                    console.log('✅ 資料更新驗證成功！');
                } else {
                    console.log('⚠️ 資料可能尚未同步或欄位映射不正確');
                }
            }
        } else {
            console.error('❌ Worker API 寫入失敗:', updateResponse);
            
            // 分析可能的問題
            if (updateResponse.status === 401) {
                console.error('🔐 認證問題：Token 可能無效或過期');
            } else if (updateResponse.status === 404) {
                console.error('📍 路由問題：API 端點不存在');
            } else if (updateResponse.status === 500) {
                console.error('💥 伺服器錯誤：檢查 Worker 日誌');
            }
        }
        
        // 7. 測試其他 API 端點
        console.log('5. 測試其他相關端點...');
        
        // 測試健康檢查
        const healthResponse = await page.evaluate(async (apiUrl) => {
            try {
                const response = await fetch(`${apiUrl}/health`);
                return {
                    success: response.ok,
                    status: response.status,
                    text: await response.text()
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }, workerApiUrl);
        
        console.log('健康檢查:', healthResponse);
        
        console.log('\n📋 測試總結:');
        console.log('- 登入:', !!token);
        console.log('- 配置載入:', !!config);
        console.log('- 案場讀取:', readResponse.success);
        console.log('- 案場寫入:', updateResponse.success);
        console.log('- API 健康:', healthResponse.success);
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
    } finally {
        console.log('\n瀏覽器將保持開啟 30 秒供檢查...');
        setTimeout(() => browser.close(), 30000);
    }
}

testWorkerApiSiteUpdate();