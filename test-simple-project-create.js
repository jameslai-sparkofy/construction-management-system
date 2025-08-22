/**
 * 測試簡化版專案創建流程
 */

const { chromium } = require('playwright');

async function testSimpleProjectCreate() {
    console.log('🚀 測試簡化版專案創建流程');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
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
        
        // 監聽 console
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Config') || text.includes('Loading') || text.includes('Creating') || text.includes('Error')) {
                console.log('🖥️ Console:', text);
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
        
        // 2. 前往簡化版專案創建頁面
        console.log('2. 前往簡化版專案創建頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-create-simple.html');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 檢查頁面載入狀態
        console.log('3. 檢查頁面載入狀態...');
        const pageCheck = await page.evaluate(() => {
            return {
                title: document.title,
                hasOpportunitySelect: !!document.getElementById('opportunitySelect'),
                hasEngineeringTypes: document.querySelectorAll('input[name="engineeringTypes"]').length,
                hasCreateButton: !!document.getElementById('createBtn'),
                configLoaded: typeof CONFIG !== 'undefined',
                opportunityOptions: document.getElementById('opportunitySelect')?.options.length || 0
            };
        });
        
        console.log('頁面檢查結果:', pageCheck);
        
        // 4. 等待商機載入
        console.log('4. 等待商機載入...');
        await page.waitForTimeout(5000);
        
        const opportunityCheck = await page.evaluate(() => {
            const select = document.getElementById('opportunitySelect');
            return {
                totalOptions: select?.options.length || 0,
                firstOption: select?.options[1]?.textContent || 'N/A',
                hasValidOptions: select?.options.length > 1
            };
        });
        
        console.log('商機載入檢查:', opportunityCheck);
        
        if (opportunityCheck.hasValidOptions) {
            // 5. 測試搜尋功能
            console.log('5. 測試商機搜尋功能...');
            await page.fill('#opportunitySearch', '勝美');
            await page.waitForTimeout(1000);
            
            const searchCheck = await page.evaluate(() => {
                const select = document.getElementById('opportunitySelect');
                const searchResult = document.getElementById('searchResult');
                return {
                    filteredOptions: select.options.length,
                    searchResultText: searchResult?.textContent || 'N/A'
                };
            });
            console.log('搜尋結果檢查:', searchCheck);
            
            // 清空搜尋並選擇第一個商機
            console.log('6. 清空搜尋並選擇第一個商機...');
            await page.fill('#opportunitySearch', '');
            await page.waitForTimeout(500);
            await page.selectOption('#opportunitySelect', { index: 1 });
            await page.waitForTimeout(1000);
            
            // 7. 選擇工程類型
            console.log('7. 選擇 SPC 工程...');
            await page.click('label[for="spcEngineering"]');
            await page.waitForTimeout(1000);
            
            console.log('8. 選擇浴櫃工程...');
            await page.click('label[for="cabinetEngineering"]');
            await page.waitForTimeout(1000);
            
            // 8. 檢查專案摘要是否顯示
            const summaryCheck = await page.evaluate(() => {
                const summary = document.getElementById('projectSummary');
                return {
                    visible: summary?.style.display !== 'none',
                    opportunityName: document.getElementById('summaryOpportunityName')?.textContent || '',
                    projectName: document.getElementById('summaryProjectName')?.textContent || '',
                    engineeringTypes: document.getElementById('summaryEngineeringTypes')?.textContent || ''
                };
            });
            
            console.log('專案摘要:', summaryCheck);
            
            // 9. 檢查建立按鈕是否啟用
            const buttonCheck = await page.evaluate(() => {
                const createBtn = document.getElementById('createBtn');
                return {
                    disabled: createBtn?.disabled,
                    text: createBtn?.textContent.trim()
                };
            });
            
            console.log('建立按鈕狀態:', buttonCheck);
            
            if (!buttonCheck.disabled) {
                // 10. 點擊建立專案（但不實際建立，改為測試模式）
                console.log('10. 測試建立專案流程...');
                
                // 檢查表單資料準備
                const formData = await page.evaluate(() => {
                    const opportunity = document.getElementById('opportunitySelect').value;
                    const spc = document.getElementById('spcEngineering').checked;
                    const cabinet = document.getElementById('cabinetEngineering').checked;
                    
                    return {
                        selectedOpportunity: opportunity,
                        spcEngineering: spc,
                        cabinetEngineering: cabinet,
                        token: localStorage.getItem('token') ? 'EXISTS' : 'MISSING'
                    };
                });
                
                console.log('表單資料準備:', formData);
                
                if (formData.selectedOpportunity && (formData.spcEngineering || formData.cabinetEngineering)) {
                    console.log('✅ 表單資料完整，專案創建流程準備就緒');
                    
                    // 可選：實際測試建立（取消註釋下面這行來實際建立）
                    // await page.click('#createBtn');
                    // await page.waitForTimeout(8000);
                } else {
                    console.log('❌ 表單資料不完整');
                }
            } else {
                console.log('❌ 建立按鈕未啟用');
            }
        } else {
            console.log('❌ 商機載入失敗');
        }
        
        console.log('\n📊 網路請求總結:');
        requests.forEach((req, i) => {
            console.log(`${i + 1}. ${req.type.toUpperCase()}: ${req.method || req.status} ${req.url}`);
        });
        
        // 截圖
        await page.screenshot({ path: 'simple-project-create-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'simple-project-create-error.png', fullPage: true });
    } finally {
        console.log('\n📋 簡化版專案創建測試完成！');
        console.log('瀏覽器將保持開啟 90 秒供檢查...');
        setTimeout(() => browser.close(), 90000);
    }
}

testSimpleProjectCreate();