/**
 * 調試 CONFIG 載入問題
 */

const { chromium } = require('playwright');

async function debugConfigLoading() {
    console.log('🔧 調試 CONFIG 載入問題');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 1. 載入專案詳情頁面
        console.log('1. 直接載入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        
        // 2. 檢查 CONFIG 載入狀態
        console.log('2. 檢查 CONFIG 載入狀態...');
        
        const configAnalysis = await page.evaluate(() => {
            return {
                // 基本 CONFIG 檢查
                configExists: typeof window.CONFIG !== 'undefined',
                configKeys: window.CONFIG ? Object.keys(window.CONFIG) : [],
                
                // API 配置檢查
                apiConfig: window.CONFIG?.API || null,
                workerApiUrl: window.CONFIG?.API?.WORKER_API_URL || 'NOT_FOUND',
                
                // 環境檢測
                environment: window.CONFIG?.ENVIRONMENT || 'UNKNOWN',
                isProduction: window.CONFIG ? window.CONFIG.ENVIRONMENT === 'production' : 'UNKNOWN',
                
                // 版本資訊
                version: window.CONFIG?.VERSION || 'UNKNOWN',
                
                // 檢查全域變數
                workerApiUrlVar: typeof window.WORKER_API_URL !== 'undefined' ? window.WORKER_API_URL : 'NOT_DEFINED',
                apiBaseUrlVar: typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : 'NOT_DEFINED',
                
                // 檢查 hostname 環境檢測
                hostname: window.location.hostname,
                
                // 檢查是否有環境變數
                hasEnvVars: typeof window.ENV !== 'undefined',
                envVars: window.ENV || null
            };
        });
        
        console.log('CONFIG 分析結果:');
        console.log(JSON.stringify(configAnalysis, null, 2));
        
        // 3. 測試環境檢測函數
        console.log('3. 測試環境檢測...');
        
        const envTest = await page.evaluate(() => {
            // 嘗試手動執行環境檢測
            if (typeof window.detectEnvironment === 'function') {
                return {
                    function: 'exists',
                    result: window.detectEnvironment()
                };
            } else {
                // 手動實現環境檢測
                const hostname = window.location.hostname;
                let env = 'development';
                
                if (hostname.includes('construction-management-frontend-prod.pages.dev') || 
                    hostname === 'cm-prod.pages.dev') {
                    env = 'production';
                } else if (hostname.includes('construction-management-frontend-dev.pages.dev') ||
                           hostname === 'localhost' || 
                           hostname === '127.0.0.1') {
                    env = 'development';
                }
                
                return {
                    function: 'manual',
                    hostname: hostname,
                    result: env
                };
            }
        });
        
        console.log('環境檢測結果:', envTest);
        
        // 4. 檢查實際的 API 呼叫 URL
        console.log('4. 檢查實際 API 呼叫...');
        
        // 監聽網路請求來看實際使用的 URL
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('api')) {
                requests.push({
                    url: request.url(),
                    method: request.method()
                });
            }
        });
        
        // 觸發一些 API 呼叫
        await page.waitForTimeout(5000);
        
        console.log('捕獲的 API 請求:');
        requests.forEach(req => {
            console.log(`  ${req.method} ${req.url}`);
        });
        
        // 5. 嘗試修復 CONFIG
        console.log('5. 嘗試手動修復 CONFIG...');
        
        const fixResult = await page.evaluate(() => {
            try {
                // 手動設置正確的 CONFIG
                if (!window.CONFIG || !window.CONFIG.API || !window.CONFIG.API.WORKER_API_URL) {
                    const hostname = window.location.hostname;
                    const isProduction = hostname.includes('construction-management-frontend-prod.pages.dev') || 
                                        hostname === 'cm-prod.pages.dev';
                    
                    const correctUrl = isProduction ? 
                        'https://construction-management-unified.lai-jameslai.workers.dev' :
                        'https://construction-management-unified.lai-jameslai.workers.dev';
                    
                    // 創建或修復 CONFIG
                    window.CONFIG = window.CONFIG || {};
                    window.CONFIG.API = window.CONFIG.API || {};
                    window.CONFIG.API.WORKER_API_URL = correctUrl;
                    window.CONFIG.ENVIRONMENT = isProduction ? 'production' : 'development';
                    
                    // 也更新全域變數
                    window.WORKER_API_URL = correctUrl;
                    
                    return {
                        success: true,
                        newUrl: correctUrl,
                        environment: isProduction ? 'production' : 'development'
                    };
                } else {
                    return {
                        success: false,
                        reason: 'CONFIG already exists',
                        currentUrl: window.CONFIG.API.WORKER_API_URL
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('修復結果:', fixResult);
        
        // 截圖
        await page.screenshot({ path: 'debug-config-loading.png', fullPage: true });
        console.log('✅ 調試截圖已保存');
        
    } catch (error) {
        console.error('❌ 調試錯誤:', error);
        await page.screenshot({ path: 'debug-config-error.png', fullPage: true });
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

debugConfigLoading();