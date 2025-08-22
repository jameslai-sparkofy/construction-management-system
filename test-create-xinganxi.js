/**
 * 測試創建興安西 SPC 專案
 */

const { chromium } = require('playwright');

async function testCreateXinganxi() {
    console.log('🚀 測試創建興安西 SPC 專案');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽 console 消息
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Engineering') || text.includes('Selected') || text.includes('Creating') || text.includes('Error')) {
                console.log('🖥️ Console:', text);
            }
        });
        
        // 監聽網路請求
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('api') || request.url().includes('newopportunityobj')) {
                requests.push({
                    type: 'request',
                    url: request.url(),
                    method: request.method()
                });
                console.log('📤 Request:', request.method(), request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('api') || response.url().includes('newopportunityobj')) {
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
        
        // 2. 前往專案創建頁面
        console.log('2. 前往簡化版專案創建頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-create-simple.html');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 搜尋興安西
        console.log('3. 搜尋興安西商機...');
        await page.fill('#opportunitySearch', '興安西');
        await page.waitForTimeout(2000);
        
        const searchResult = await page.evaluate(() => {
            const select = document.getElementById('opportunitySelect');
            const searchResult = document.getElementById('searchResult');
            return {
                filteredOptions: select.options.length,
                searchResultText: searchResult?.textContent || 'N/A',
                hasXinganxi: Array.from(select.options).some(option => 
                    option.textContent.includes('興安西')
                )
            };
        });
        
        console.log('搜尋結果:', searchResult);
        
        if (searchResult.hasXinganxi) {
            // 4. 選擇興安西商機
            console.log('4. 選擇興安西商機...');
            await page.evaluate(() => {
                const select = document.getElementById('opportunitySelect');
                const xinganxiOption = Array.from(select.options).find(option => 
                    option.textContent.includes('興安西')
                );
                if (xinganxiOption) {
                    select.value = xinganxiOption.value;
                    select.dispatchEvent(new Event('change'));
                }
            });
            await page.waitForTimeout(1000);
            
            // 5. 選擇 SPC 工程
            console.log('5. 選擇 SPC 工程...');
            await page.click('label[for="spcEngineering"]');
            await page.waitForTimeout(2000);
            
            // 6. 檢查狀態
            const statusCheck = await page.evaluate(() => {
                const spcCheckbox = document.getElementById('spcEngineering');
                const summaryOpportunity = document.getElementById('summaryOpportunityName')?.textContent;
                const summaryProject = document.getElementById('summaryProjectName')?.textContent;
                const summaryTypes = document.getElementById('summaryEngineeringTypes')?.textContent;
                const createBtn = document.getElementById('createBtn');
                
                return {
                    spcChecked: spcCheckbox.checked,
                    opportunityName: summaryOpportunity,
                    projectName: summaryProject,
                    engineeringTypes: summaryTypes,
                    createButtonEnabled: !createBtn.disabled,
                    selectedTypes: window.selectedEngineeringTypes || 'undefined'
                };
            });
            
            console.log('狀態檢查:', statusCheck);
            
            if (statusCheck.createButtonEnabled) {
                console.log('6. 點擊建立專案...');
                await page.click('#createBtn');
                await page.waitForTimeout(8000);
                
                // 檢查是否成功
                const currentUrl = page.url();
                if (currentUrl.includes('project-detail') || currentUrl.includes('project-list')) {
                    console.log('✅ 專案創建成功！跳轉到:', currentUrl);
                } else {
                    console.log('⚠️ 專案創建後未跳轉，當前頁面:', currentUrl);
                }
            } else {
                console.log('❌ 建立按鈕未啟用，無法建立專案');
            }
        } else {
            console.log('❌ 未找到興安西商機');
        }
        
        // 截圖
        await page.screenshot({ path: 'xinganxi-project-create.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
        console.log('\\n📊 網路請求總結:');
        requests.forEach((req, i) => {
            console.log(`${i + 1}. ${req.type.toUpperCase()}: ${req.method || req.status} ${req.url}`);
        });
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'xinganxi-project-error.png', fullPage: true });
    } finally {
        console.log('\\n📋 興安西 SPC 專案創建測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testCreateXinganxi();