/**
 * 測試專案用戶管理頁面載入問題
 */

const { chromium } = require('playwright');

async function testUserManagementPage() {
    console.log('🚀 測試專案用戶管理頁面載入');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 消息
        page.on('console', msg => {
            const text = msg.text();
            console.log('🖥️ Console:', text);
        });
        
        // 監聽網路請求
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('api')) {
                requests.push({
                    type: 'request',
                    url: request.url(),
                    method: request.method()
                });
                console.log('📤 Request:', request.method(), request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('api')) {
                requests.push({
                    type: 'response',
                    url: response.url(),
                    status: response.status()
                });
                console.log('📥 Response:', response.status(), response.url());
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
        
        // 2. 前往專案用戶管理頁面
        console.log('2. 前往專案用戶管理頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-user-management?project_id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(8000);
        
        // 3. 檢查頁面載入狀態
        console.log('3. 檢查頁面載入狀態...');
        const pageStatus = await page.evaluate(() => {
            return {
                title: document.title,
                hasProjectInfo: !!document.querySelector('.project-info'),
                hasUserSourceTabs: !!document.querySelector('.user-source-tabs'),
                hasAvailableUsers: !!document.querySelector('.available-users'),
                hasProjectUsers: !!document.querySelector('.project-users'),
                hasErrorMessages: document.querySelectorAll('.error-message, .alert').length,
                apiBaseUrl: window.CONFIG?.API?.WORKER_API_URL || 'NOT_FOUND',
                projectId: new URLSearchParams(window.location.search).get('project_id'),
                currentUser: window.currentUserData || 'NOT_LOADED',
                projectUsersList: window.projectUsersList || 'NOT_LOADED'
            };
        });
        
        console.log('頁面狀態檢查:', pageStatus);
        
        // 4. 檢查具體的數據載入狀態
        const dataStatus = await page.evaluate(() => {
            const checkElement = (selector, description) => {
                const element = document.querySelector(selector);
                return {
                    exists: !!element,
                    visible: element ? element.style.display !== 'none' : false,
                    content: element ? element.textContent.trim().substring(0, 100) : 'N/A',
                    innerHTML: element ? element.innerHTML.substring(0, 200) : 'N/A'
                };
            };
            
            return {
                adminsList: checkElement('#adminsList', '管理員列表'),
                ownersList: checkElement('#ownersList', '業主列表'),
                workerTeamTabs: checkElement('#workerTeamTabs', '工班分頁'),
                availableUsersList: checkElement('#availableUsersList', '可用用戶列表'),
                projectAdmins: checkElement('#projectAdmins', '專案管理員'),
                projectOwners: checkElement('#projectOwners', '專案業主'),
                projectTeamLeaders: checkElement('#projectTeamLeaders', '工班領班'),
                projectWorkers: checkElement('#projectWorkers', '專案師父')
            };
        });
        
        console.log('數據載入狀態:', JSON.stringify(dataStatus, null, 2));
        
        // 5. 測試用戶來源切換
        console.log('5. 測試用戶來源切換...');
        const tabSwitching = await page.evaluate(() => {
            const tabs = document.querySelectorAll('.source-tab');
            const results = [];
            
            tabs.forEach((tab, index) => {
                results.push({
                    index: index,
                    text: tab.textContent.trim(),
                    active: tab.classList.contains('active'),
                    clickable: !tab.disabled
                });
            });
            
            return results;
        });
        
        console.log('用戶來源分頁狀態:', tabSwitching);
        
        // 6. 檢查錯誤訊息
        const errors = await page.evaluate(() => {
            const errorElements = document.querySelectorAll('.error, .alert, [style*="color: red"]');
            return Array.from(errorElements).map(el => el.textContent.trim());
        });
        
        if (errors.length > 0) {
            console.log('❌ 發現錯誤訊息:', errors);
        } else {
            console.log('✅ 未發現錯誤訊息');
        }
        
        // 截圖
        await page.screenshot({ path: 'user-management-page-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
        console.log('\\n📊 網路請求總結:');
        requests.forEach((req, i) => {
            console.log(`${i + 1}. ${req.type.toUpperCase()}: ${req.method || req.status} ${req.url}`);
        });
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'user-management-page-error.png', fullPage: true });
    } finally {
        console.log('\\n📋 專案用戶管理頁面測試完成！');
        console.log('瀏覽器將保持開啟 120 秒供檢查...');
        setTimeout(() => browser.close(), 120000);
    }
}

testUserManagementPage();