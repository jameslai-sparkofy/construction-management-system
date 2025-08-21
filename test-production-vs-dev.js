/**
 * 比較生產版與開發版差異
 */

const { chromium } = require('playwright');

async function testProductionVsDev() {
    console.log('🔄 比較生產版與開發版');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    
    try {
        // 測試生產版
        console.log('\n=== 測試生產版 ===');
        const prodPage = await browser.newPage();
        
        await prodPage.goto('https://construction-management-frontend-prod.pages.dev/login-simple.html');
        await prodPage.waitForLoadState('networkidle');
        
        await prodPage.fill('input[type="tel"]', '0912345678');
        await prodPage.fill('input[type="password"]', '678');
        await prodPage.click('button[type="submit"]');
        await prodPage.waitForTimeout(3000);
        
        console.log('✅ 生產版登入成功');
        
        // 前往專案詳情
        await prodPage.goto('https://construction-management-frontend-prod.pages.dev/project-detail.html?id=proj_1755783317062');
        await prodPage.waitForLoadState('networkidle');
        await prodPage.waitForTimeout(8000);
        
        const prodInfo = await prodPage.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                apiUrl: window.CONFIG?.API?.WORKER_API_URL,
                environment: window.CONFIG?.ENVIRONMENT,
                siteElements: document.querySelectorAll('.grid-cell, td[onclick*="openSiteModal"]').length,
                hasError: document.body.textContent.includes('載入專案失敗'),
                bodyPreview: document.body.textContent.substring(0, 200)
            };
        });
        
        console.log('生產版資訊:', prodInfo);
        
        await prodPage.screenshot({ path: 'production-test.png', fullPage: true });
        
        // 測試開發版
        console.log('\n=== 測試開發版 ===');
        const devPage = await browser.newPage();
        
        await devPage.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await devPage.waitForLoadState('networkidle');
        
        await devPage.fill('input[type="tel"]', '0912345678');
        await devPage.fill('input[type="password"]', '678');
        await devPage.click('button[type="submit"]');
        await devPage.waitForTimeout(3000);
        
        console.log('✅ 開發版登入成功');
        
        // 前往專案詳情
        await devPage.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await devPage.waitForLoadState('networkidle');
        await devPage.waitForTimeout(8000);
        
        const devInfo = await devPage.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                apiUrl: window.CONFIG?.API?.WORKER_API_URL,
                environment: window.CONFIG?.ENVIRONMENT,
                siteElements: document.querySelectorAll('.grid-cell, td[onclick*="openSiteModal"]').length,
                hasError: document.body.textContent.includes('載入專案失敗'),
                bodyPreview: document.body.textContent.substring(0, 200)
            };
        });
        
        console.log('開發版資訊:', devInfo);
        
        await devPage.screenshot({ path: 'development-test.png', fullPage: true });
        
        // 比較差異
        console.log('\n=== 差異分析 ===');
        console.log('API URL 差異:');
        console.log(`  生產版: ${prodInfo.apiUrl}`);
        console.log(`  開發版: ${devInfo.apiUrl}`);
        
        console.log('案場元素數量:');
        console.log(`  生產版: ${prodInfo.siteElements}`);
        console.log(`  開發版: ${devInfo.siteElements}`);
        
        console.log('錯誤狀態:');
        console.log(`  生產版有錯誤: ${prodInfo.hasError}`);
        console.log(`  開發版有錯誤: ${devInfo.hasError}`);
        
        // 如果生產版有案場但開發版沒有，檢查 API 回應
        if (prodInfo.siteElements > 0 && devInfo.siteElements === 0) {
            console.log('\n=== API 回應比較 ===');
            
            // 測試生產版 API
            const prodApiTest = await prodPage.evaluate(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/api/v1/projects/proj_1755783317062`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const data = await response.json();
                    return {
                        success: response.ok,
                        status: response.status,
                        sitesCount: data.sites?.length || 0,
                        projectExists: !!data.project
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            // 測試開發版 API
            const devApiTest = await devPage.evaluate(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/api/v1/projects/proj_1755783317062`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const data = await response.json();
                    return {
                        success: response.ok,
                        status: response.status,
                        sitesCount: data.sites?.length || 0,
                        projectExists: !!data.project
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            console.log('生產版 API 回應:', prodApiTest);
            console.log('開發版 API 回應:', devApiTest);
        }
        
        await prodPage.close();
        await devPage.close();
        
    } catch (error) {
        console.error('❌ 比較過程發生錯誤:', error);
    } finally {
        console.log('\n📋 比較完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testProductionVsDev();