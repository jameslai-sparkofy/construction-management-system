/**
 * 測試師父角色設定bug
 * 檢查：不管設定師父為成員還是負責人，加入專案時都變成成員身份
 */

const { chromium } = require('playwright');

async function testWorkerRoleBug() {
    console.log('🚀 測試師父角色設定bug');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 消息
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Adding user') || text.includes('Role') || text.includes('Error')) {
                console.log('🖥️ Console:', text);
            }
        });
        
        // 監聽網路請求
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('api') && request.method() === 'POST') {
                requests.push({
                    type: 'request',
                    url: request.url(),
                    method: request.method(),
                    postData: request.postData()
                });
                console.log('📤 POST Request:', request.url());
                if (request.postData()) {
                    console.log('📤 POST Data:', request.postData());
                }
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('api') && response.request().method() === 'POST') {
                requests.push({
                    type: 'response',
                    url: response.url(),
                    status: response.status()
                });
                console.log('📥 POST Response:', response.status(), response.url());
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
        await page.waitForTimeout(5000);
        
        // 3. 檢查是否有角色文字顯示修復
        console.log('3. 檢查角色文字顯示修復...');
        const roleDisplay = await page.evaluate(() => {
            const userItems = document.querySelectorAll('.project-user-item .user-name');
            const rolesFound = [];
            userItems.forEach(item => {
                if (item.textContent.includes('(') && item.textContent.includes(')')) {
                    rolesFound.push(item.textContent.trim());
                }
            });
            return rolesFound;
        });
        
        console.log('✅ 找到的角色顯示:', roleDisplay);
        
        // 4. 點擊師父分頁
        console.log('4. 切換到師父分頁...');
        await page.click('[data-source="workers"]');
        await page.waitForTimeout(3000);
        
        // 5. 檢查是否有師父資料
        const hasWorkers = await page.evaluate(() => {
            const workersList = document.querySelector('#availableUsersList');
            return workersList && workersList.children.length > 0;
        });
        
        if (hasWorkers) {
            console.log('5. 發現師父資料，測試角色設定...');
            
            // 選擇第一個師父
            await page.click('#availableUsersList .available-user-item:first-child');
            await page.waitForTimeout(1000);
            
            // 檢查角色選擇器是否顯示
            const roleSelector = await page.evaluate(() => {
                const selector = document.getElementById('roleSelector');
                return {
                    visible: selector && selector.style.display !== 'none',
                    currentValue: selector ? document.getElementById('userRole').value : null
                };
            });
            
            console.log('角色選擇器狀態:', roleSelector);
            
            // 測試1：設定為負責人
            console.log('6. 測試設定師父為負責人...');
            if (roleSelector.visible) {
                await page.selectOption('#userRole', 'leader');
                await page.waitForTimeout(1000);
                
                // 點擊添加按鈕
                await page.click('#addUserButton');
                await page.waitForTimeout(5000);
                
                // 檢查添加結果
                const addResult = await page.evaluate(() => {
                    const workerUsers = document.getElementById('workerUsers');
                    const userItems = workerUsers.querySelectorAll('.project-user-item');
                    const results = [];
                    
                    userItems.forEach(item => {
                        const userName = item.querySelector('.user-name').textContent;
                        const isLeader = item.classList.contains('leader-item');
                        const roleSwitch = item.querySelector('.role-switch input');
                        const switchChecked = roleSwitch ? roleSwitch.checked : false;
                        
                        results.push({
                            name: userName,
                            isLeaderClass: isLeader,
                            switchChecked: switchChecked,
                            roleText: userName.includes('負責人') ? '負責人' : (userName.includes('成員') ? '成員' : '未知')
                        });
                    });
                    
                    return results;
                });
                
                console.log('添加師父為負責人的結果:', addResult);
                
                // 檢查是否有bug
                const hasBug = addResult.some(user => {
                    // 如果設定為負責人但顯示為成員，就是bug
                    return !user.isLeaderClass && user.roleText === '成員' && !user.switchChecked;
                });
                
                if (hasBug) {
                    console.log('❌ Bug確認：師父設定為負責人但加入後變成成員');
                } else {
                    console.log('✅ 師父負責人設定正常');
                }
            }
        } else {
            console.log('⚠️ 沒有師父資料可測試，嘗試創建新師父...');
            
            // 點擊創建新師父按鈕
            const createWorkerBtn = await page.$('#createWorkerToggle');
            if (createWorkerBtn) {
                await createWorkerBtn.click();
                await page.waitForTimeout(1000);
                
                // 填寫師父資料
                await page.fill('#workerName', '測試師父負責人');
                await page.fill('#workerPhone', '0987654321');
                await page.fill('#workerNickname', '測試');
                
                // 選擇負責人角色
                await page.selectOption('#workerRole', 'leader');
                
                // 提交
                await page.click('#createWorkerBtn');
                await page.waitForTimeout(5000);
                
                console.log('已創建測試師父，請手動檢查角色設定結果');
            }
        }
        
        // 截圖
        await page.screenshot({ path: 'worker-role-bug-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
        console.log('\n📊 網路請求總結:');
        requests.forEach((req, i) => {
            console.log(`${i + 1}. ${req.type.toUpperCase()}: ${req.method || req.status} ${req.url}`);
            if (req.postData) {
                console.log(`   Data: ${req.postData}`);
            }
        });
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'worker-role-bug-error.png', fullPage: true });
    } finally {
        console.log('\n📋 師父角色設定bug測試完成！');
        console.log('瀏覽器將保持開啟 120 秒供檢查...');
        setTimeout(() => browser.close(), 120000);
    }
}

testWorkerRoleBug();