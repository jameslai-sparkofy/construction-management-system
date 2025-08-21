/**
 * 直接測試 API 呼叫
 */

const { chromium } = require('playwright');

async function testApiDirect() {
    console.log('🔗 直接測試 API 呼叫');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 1. 登入取得 token
        console.log('1. 登入取得 token...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 2. 獲取 token
        const token = await page.evaluate(() => localStorage.getItem('token'));
        console.log('Token 長度:', token?.length || 0);
        console.log('Token 前綴:', token?.substring(0, 30) + '...' || 'MISSING');
        
        // 3. 直接測試 API 呼叫
        console.log('3. 測試專案 API...');
        
        const projectApiTest = await page.evaluate(async () => {
            try {
                const token = localStorage.getItem('token');
                const apiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
                const projectId = 'proj_1755783317062';
                
                const response = await fetch(`${apiUrl}/api/v1/projects/${projectId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                return {
                    success: response.ok,
                    status: response.status,
                    dataKeys: Object.keys(data),
                    hasProject: !!data.project,
                    hasSites: !!data.sites,
                    sitesCount: data.sites?.length || 0,
                    errorMessage: data.error || null
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('專案 API 測試結果:', projectApiTest);
        
        if (projectApiTest.success && projectApiTest.sitesCount > 0) {
            console.log('✅ 專案 API 正常，有案場資料');
            
            // 4. 測試 PATCH 案場
            console.log('4. 測試 PATCH 案場 API...');
            
            const patchApiTest = await page.evaluate(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const apiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
                    const siteId = '677633f67f855e00016ff02c'; // 已知的案場 ID
                    
                    const testData = {
                        field_sF6fn__c: `直接 API 測試 - ${new Date().toLocaleString('zh-TW')}`
                    };
                    
                    const response = await fetch(`${apiUrl}/rest/object_8W9cb__c/${siteId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(testData)
                    });
                    
                    const data = await response.json();
                    
                    return {
                        success: response.ok,
                        status: response.status,
                        requestData: testData,
                        responseData: data,
                        errorMessage: data.error || null
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            console.log('PATCH API 測試結果:', patchApiTest);
            
            if (patchApiTest.success) {
                console.log('🎉 PATCH API 測試成功！');
                
                // 5. 驗證更新
                console.log('5. 驗證更新...');
                
                const verifyTest = await page.evaluate(async () => {
                    try {
                        const token = localStorage.getItem('token');
                        const apiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
                        const projectId = 'proj_1755783317062';
                        
                        const response = await fetch(`${apiUrl}/api/v1/projects/${projectId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const data = await response.json();
                        const site = data.sites?.find(s => s.id === '677633f67f855e00016ff02c');
                        
                        return {
                            success: response.ok,
                            siteFound: !!site,
                            beforeNotes: site?.field_sF6fn__c || 'NOT_FOUND',
                            containsTestText: site?.field_sF6fn__c?.includes('直接 API 測試') || false
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                });
                
                console.log('驗證結果:', verifyTest);
                
                if (verifyTest.containsTestText) {
                    console.log('✅ 完整測試成功：案場寫入功能正常運作！');
                    console.log('🎯 問題在於前端頁面載入，而非 API 功能');
                } else {
                    console.log('⚠️ 更新未正確保存');
                }
            } else {
                console.log('❌ PATCH API 失敗:', patchApiTest.errorMessage);
            }
        } else {
            console.log('❌ 專案 API 失敗或沒有案場資料');
        }
        
        await page.screenshot({ path: 'api-direct-test.png', fullPage: true });
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'api-direct-error.png', fullPage: true });
    } finally {
        console.log('\n📋 直接 API 測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testApiDirect();