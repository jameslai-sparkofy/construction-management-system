/**
 * 最終測試師父角色設定修復
 */

const { chromium } = require('playwright');

async function testWorkerRoleFinal() {
    console.log('🚀 最終測試師父角色設定修復');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 監聽網路請求
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('api') && (request.method() === 'POST' || request.url().includes('users'))) {
                console.log('📤 Request:', request.method(), request.url());
                if (request.postData()) {
                    try {
                        const data = JSON.parse(request.postData());
                        console.log('📤 POST Data role:', data.role);
                    } catch (e) {
                        console.log('📤 POST Data:', request.postData().substring(0, 100));
                    }
                }
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('api') && (response.request().method() === 'POST' || response.url().includes('users'))) {
                console.log('📥 Response:', response.status(), response.url());
            }
        });
        
        // 1. 登入
        console.log('\n1. 登入開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 2. 前往專案用戶管理頁面
        console.log('\n2. 前往專案用戶管理頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-user-management?project_id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 檢查角色文字顯示修復
        console.log('\n3. 檢查現有用戶的角色顯示...');
        const existingRoles = await page.evaluate(() => {
            const userItems = document.querySelectorAll('.project-user-item');
            const roles = [];
            
            userItems.forEach(item => {
                const nameElement = item.querySelector('.user-name');
                const isLeaderClass = item.classList.contains('leader-item');
                const roleSwitch = item.querySelector('.role-switch input');
                
                if (nameElement) {
                    roles.push({
                        name: nameElement.textContent.trim(),
                        hasLeaderClass: isLeaderClass,
                        switchChecked: roleSwitch ? roleSwitch.checked : null,
                        hasRoleText: nameElement.textContent.includes('(') && nameElement.textContent.includes(')')
                    });
                }
            });
            
            return roles;
        });
        
        console.log('現有用戶角色顯示:', existingRoles);
        
        // 4. 測試添加師父為負責人
        console.log('\n4. 測試添加師父為負責人...');
        
        // 點擊師父分頁
        await page.click('[data-source="workers"]');
        await page.waitForTimeout(3000);
        
        // 檢查是否有可用師父
        const hasWorkers = await page.evaluate(() => {
            const list = document.querySelector('#availableUsersList');
            return list && list.children.length > 0;
        });
        
        if (hasWorkers) {
            console.log('發現可用師父，進行角色測試...');
            
            // 選擇第一個師父
            await page.click('#availableUsersList .available-user-item:first-child');
            await page.waitForTimeout(1000);
            
            // 檢查角色選擇器
            const roleSelector = await page.evaluate(() => {
                const selector = document.getElementById('roleSelector');
                const userRole = document.getElementById('userRole');
                return {
                    visible: selector && selector.style.display !== 'none',
                    currentValue: userRole ? userRole.value : null,
                    options: userRole ? Array.from(userRole.options).map(opt => ({value: opt.value, text: opt.text})) : []
                };
            });
            
            console.log('角色選擇器狀態:', roleSelector);
            
            if (roleSelector.visible) {
                // 設定為負責人
                await page.selectOption('#userRole', 'leader');
                await page.waitForTimeout(1000);
                
                // 確認選擇值
                const selectedValue = await page.evaluate(() => {
                    return document.getElementById('userRole').value;
                });
                console.log('選擇的角色:', selectedValue);
                
                // 點擊添加按鈕
                console.log('點擊添加按鈕...');
                await page.click('#addUserButton');
                await page.waitForTimeout(8000);
                
                // 檢查添加結果 - 查看所有工班成員
                const addResult = await page.evaluate(() => {
                    const results = [];
                    const teamSections = document.querySelectorAll('.team-section, #workerUsers .project-user-item');
                    
                    // 如果有工班分頁，檢查每個分頁
                    const teamButtons = document.querySelectorAll('.team-tab-button');
                    if (teamButtons.length > 0) {
                        teamButtons.forEach(btn => {
                            results.push({
                                type: 'team_tab',
                                teamName: btn.textContent.trim(),
                                active: btn.classList.contains('active')
                            });
                        });
                    }
                    
                    // 檢查當前顯示的用戶
                    const userItems = document.querySelectorAll('#workerUsers .project-user-item');
                    userItems.forEach(item => {
                        const nameElement = item.querySelector('.user-name');
                        const isLeaderClass = item.classList.contains('leader-item');
                        const roleSwitch = item.querySelector('.role-switch input');
                        
                        if (nameElement) {
                            results.push({
                                type: 'user',
                                name: nameElement.textContent.trim(),
                                hasLeaderClass: isLeaderClass,
                                switchChecked: roleSwitch ? roleSwitch.checked : null,
                                hasRoleText: nameElement.textContent.includes('負責人') || nameElement.textContent.includes('成員')
                            });
                        }
                    });
                    
                    return results;
                });
                
                console.log('\n添加師父為負責人的結果:');
                addResult.forEach((item, i) => {
                    console.log(`${i + 1}. ${item.type}: ${JSON.stringify(item)}`);
                });
                
                // 驗證修復是否成功
                const leaderUsers = addResult.filter(item => 
                    item.type === 'user' && 
                    (item.hasLeaderClass || item.switchChecked || item.name.includes('負責人'))
                );
                
                if (leaderUsers.length > 0) {
                    console.log('✅ 修復成功！發現負責人用戶:', leaderUsers);
                } else {
                    console.log('❌ 可能仍有問題，未發現正確的負責人顯示');
                }
                
            } else {
                console.log('❌ 角色選擇器未顯示');
            }
            
        } else {
            console.log('⚠️ 沒有可用師父，嘗試創建新師父測試...');
            
            // 測試創建新師父
            const createBtn = await page.$('#createWorkerToggle');
            if (createBtn) {
                await createBtn.click();
                await page.waitForTimeout(1000);
                
                console.log('創建新師父表單已開啟，手動測試...');
            }
        }
        
        // 截圖
        await page.screenshot({ path: 'worker-role-final-test.png', fullPage: true });
        console.log('\n✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'worker-role-final-error.png', fullPage: true });
    } finally {
        console.log('\n📋 師父角色設定最終測試完成！');
        console.log('瀏覽器將保持開啟 90 秒供檢查...');
        setTimeout(() => browser.close(), 90000);
    }
}

testWorkerRoleFinal();