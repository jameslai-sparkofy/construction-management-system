/**
 * 調試專案列表載入問題
 */

const { chromium } = require('playwright');

async function debugProjectList() {
    console.log('🔍 調試專案列表載入問題');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 錯誤
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('🚨 Console Error:', msg.text());
            }
        });
        
        // 監聽網路失敗
        page.on('requestfailed', request => {
            console.log('🌐 Request Failed:', request.url(), request.failure()?.errorText);
        });
        
        // 監聽網路回應
        page.on('response', response => {
            if (!response.ok() && response.url().includes('api')) {
                console.log('📡 API Error:', response.url(), response.status());
            }
        });
        
        // 1. 登入
        console.log('1. 登入並檢查專案列表...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        console.log('當前 URL:', page.url());
        
        if (!page.url().includes('project-list')) {
            throw new Error('未成功跳轉到專案列表');
        }
        
        // 2. 檢查頁面載入狀態
        console.log('2. 檢查頁面載入狀態...');
        
        // 等待 JavaScript 執行完成
        await page.waitForTimeout(5000);
        
        // 檢查 CONFIG 是否正確載入
        const configCheck = await page.evaluate(() => {
            return {
                configExists: typeof window.CONFIG !== 'undefined',
                workerApiUrl: window.CONFIG?.API?.WORKER_API_URL,
                authUtilsExists: typeof window.AuthUtils !== 'undefined'
            };
        });
        
        console.log('CONFIG 檢查:', configCheck);
        
        // 3. 檢查專案 API 呼叫
        console.log('3. 檢查專案 API 呼叫...');
        
        const apiTest = await page.evaluate(async () => {
            try {
                // 檢查 AuthUtils.getRequestHeaders
                const headers = window.AuthUtils ? window.AuthUtils.getRequestHeaders() : {};
                
                const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL || 'https://construction-management-api-dev.lai-jameslai.workers.dev'}/api/v1/projects`, {
                    headers: headers
                });
                
                const data = await response.json();
                
                return {
                    success: response.ok,
                    status: response.status,
                    headers: headers,
                    dataKeys: Object.keys(data),
                    projectCount: data.projects?.length || 0
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('API 測試結果:', apiTest);
        
        // 4. 檢查 DOM 元素
        console.log('4. 檢查 DOM 元素...');
        
        const domCheck = await page.evaluate(() => {
            const projectsTableBody = document.getElementById('projectsTableBody');
            const loadingElement = document.getElementById('loading');
            const emptyState = document.getElementById('emptyState');
            
            return {
                tableBodyExists: !!projectsTableBody,
                tableBodyHTML: projectsTableBody?.innerHTML.substring(0, 200) || 'N/A',
                loadingVisible: loadingElement && getComputedStyle(loadingElement).display !== 'none',
                emptyStateVisible: emptyState && getComputedStyle(emptyState).display !== 'none',
                projectRows: document.querySelectorAll('#projectsTableBody tr').length
            };
        });
        
        console.log('DOM 檢查:', domCheck);
        
        // 5. 手動呼叫 loadProjects 函數
        console.log('5. 手動呼叫 loadProjects...');
        
        const manualLoad = await page.evaluate(async () => {
            try {
                if (typeof window.loadProjects === 'function') {
                    await window.loadProjects();
                    return { success: true, message: 'loadProjects executed' };
                } else {
                    return { success: false, message: 'loadProjects function not found' };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('手動載入結果:', manualLoad);
        
        // 等待一下看是否有變化
        await page.waitForTimeout(5000);
        
        // 再次檢查 DOM
        const finalCheck = await page.evaluate(() => {
            return {
                projectRows: document.querySelectorAll('#projectsTableBody tr').length,
                tableContent: document.getElementById('projectsTableBody')?.innerHTML.substring(0, 300) || 'N/A'
            };
        });
        
        console.log('最終檢查:', finalCheck);
        
        // 截圖
        await page.screenshot({ path: 'debug-project-list.png', fullPage: true });
        console.log('✅ 調試截圖已保存');
        
    } catch (error) {
        console.error('❌ 調試過程錯誤:', error);
        await page.screenshot({ path: 'debug-project-list-error.png', fullPage: true });
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

debugProjectList();