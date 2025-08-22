/**
 * 專門測試工程類型選擇的腳本
 */

const { chromium } = require('playwright');

async function testEngineeringSelection() {
    console.log('🚀 測試工程類型選擇功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 2000
    });
    const page = await browser.newPage();
    
    try {
        // 監聽所有 console 消息
        page.on('console', msg => {
            console.log('🖥️ Console:', msg.text());
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
        
        // 3. 選擇商機
        console.log('3. 選擇第一個商機...');
        await page.selectOption('#opportunitySelect', { index: 1 });
        await page.waitForTimeout(1000);
        
        // 4. 檢查工程類型選擇區域
        console.log('4. 檢查工程類型選擇區域...');
        const engineeringCheck = await page.evaluate(() => {
            const spcOption = document.querySelector('label[for="spcEngineering"]');
            const cabinetOption = document.querySelector('label[for="cabinetEngineering"]');
            const spcCheckbox = document.getElementById('spcEngineering');
            const cabinetCheckbox = document.getElementById('cabinetEngineering');
            
            return {
                spcOptionExists: !!spcOption,
                cabinetOptionExists: !!cabinetOption,
                spcCheckboxExists: !!spcCheckbox,
                cabinetCheckboxExists: !!cabinetCheckbox,
                spcCheckboxChecked: spcCheckbox?.checked || false,
                cabinetCheckboxChecked: cabinetCheckbox?.checked || false,
                selectedEngineeringTypes: window.selectedEngineeringTypes || 'undefined'
            };
        });
        
        console.log('工程類型元素檢查:', engineeringCheck);
        
        // 5. 測試直接點擊 checkbox
        console.log('5. 測試直接點擊 SPC checkbox...');
        await page.check('#spcEngineering');
        await page.waitForTimeout(2000);
        
        // 6. 檢查狀態
        const afterDirectClick = await page.evaluate(() => {
            const spcCheckbox = document.getElementById('spcEngineering');
            return {
                spcChecked: spcCheckbox.checked,
                selectedTypes: window.selectedEngineeringTypes || 'undefined',
                summaryText: document.getElementById('summaryEngineeringTypes')?.textContent
            };
        });
        
        console.log('直接點擊 checkbox 後狀態:', afterDirectClick);
        
        // 7. 測試點擊 label
        console.log('7. 測試點擊浴櫃 label...');
        await page.click('label[for="cabinetEngineering"]');
        await page.waitForTimeout(2000);
        
        // 8. 最終檢查
        const finalCheck = await page.evaluate(() => {
            const spcCheckbox = document.getElementById('spcEngineering');
            const cabinetCheckbox = document.getElementById('cabinetEngineering');
            return {
                spcChecked: spcCheckbox.checked,
                cabinetChecked: cabinetCheckbox.checked,
                selectedTypes: window.selectedEngineeringTypes || 'undefined',
                summaryText: document.getElementById('summaryEngineeringTypes')?.textContent,
                createButtonDisabled: document.getElementById('createBtn')?.disabled
            };
        });
        
        console.log('最終狀態檢查:', finalCheck);
        
        // 截圖
        await page.screenshot({ path: 'engineering-selection-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'engineering-selection-error.png', fullPage: true });
    } finally {
        console.log('\n📋 工程類型選擇測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testEngineeringSelection();