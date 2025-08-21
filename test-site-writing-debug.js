/**
 * 調試版案場寫入測試
 */

const { chromium } = require('playwright');

async function debugSiteWriting() {
    console.log('🔍 調試案場寫入功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 1. 登入
        console.log('1. 登入...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        console.log('當前 URL:', page.url());
        
        // 2. 檢查專案列表頁面內容
        if (page.url().includes('project-list')) {
            console.log('✅ 成功跳轉到專案列表');
            
            // 檢查頁面內容
            const pageContent = await page.evaluate(() => document.body.innerText);
            console.log('頁面內容前200字:', pageContent.substring(0, 200));
            
            // 尋找所有可能的專案元素
            const projectElements = await page.$$eval('*', elements => 
                elements.filter(el => 
                    el.textContent && (
                        el.textContent.includes('專案') || 
                        el.textContent.includes('project') ||
                        el.className?.includes('project') ||
                        el.id?.includes('project')
                    )
                ).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    textContent: el.textContent.substring(0, 50)
                }))
            );
            
            console.log('找到的專案相關元素:', projectElements);
            
            // 尋找所有點擊元素
            const clickableElements = await page.$$eval('a, button, [onclick], .clickable', elements => 
                elements.map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    textContent: el.textContent?.substring(0, 30) || '',
                    href: el.href || ''
                }))
            );
            
            console.log('可點擊元素:', clickableElements.slice(0, 5)); // 只顯示前5個
            
            // 3. 直接導航到一個已知的專案詳情頁面
            console.log('2. 直接導航到專案詳情頁面...');
            await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755555899996');
            await page.waitForLoadState('networkidle');
            
            console.log('✅ 進入專案詳情頁面');
            
            // 4. 等待案場資料載入
            console.log('3. 等待案場資料載入...');
            await page.waitForTimeout(5000);
            
            // 檢查頁面內容
            const detailContent = await page.evaluate(() => document.body.innerText);
            console.log('詳情頁面內容前200字:', detailContent.substring(0, 200));
            
            // 尋找案場相關元素
            const siteElements = await page.$$eval('*', elements => 
                elements.filter(el => 
                    el.className?.includes('grid-cell') ||
                    el.className?.includes('site') ||
                    el.onclick || 
                    (el.textContent && el.textContent.match(/\d+F-\d+/)) // 樓層-戶別格式
                ).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    textContent: el.textContent?.substring(0, 30) || '',
                    hasClick: !!el.onclick
                }))
            );
            
            console.log('找到的案場元素:', siteElements.slice(0, 10));
            
            // 5. 嘗試點擊第一個案場
            const firstSiteElement = await page.$('.grid-cell, [onclick*="openSiteModal"], td[onclick]');
            if (firstSiteElement) {
                console.log('4. 點擊第一個案場...');
                await firstSiteElement.click();
                await page.waitForTimeout(3000);
                
                // 檢查 Modal 是否打開
                const modal = await page.$('#siteModal');
                const modalActive = await page.$('#siteModal.active');
                
                console.log('Modal 存在:', !!modal);
                console.log('Modal 活動:', !!modalActive);
                
                if (modalActive) {
                    console.log('✅ 案場 Modal 已打開，開始測試寫入...');
                    
                    // 填寫測試資料
                    const testNote = `Playwright 測試 - ${new Date().toLocaleString()}`;
                    
                    const notesInput = await page.$('#notesInput');
                    if (notesInput) {
                        await notesInput.fill(testNote);
                        console.log(`✅ 已填寫備註: ${testNote}`);
                        
                        // 提交
                        const submitButton = await page.$('button.btn-submit, .btn-submit');
                        if (submitButton) {
                            console.log('5. 提交更新...');
                            
                            // 監聽 alert
                            let alertReceived = false;
                            page.on('dialog', async dialog => {
                                console.log(`收到 Alert: ${dialog.message()}`);
                                alertReceived = true;
                                await dialog.accept();
                            });
                            
                            await submitButton.click();
                            await page.waitForTimeout(8000);
                            
                            if (alertReceived) {
                                console.log('✅ 寫入測試完成！');
                            } else {
                                console.log('⚠️ 未收到提交結果 Alert');
                            }
                        } else {
                            console.log('❌ 找不到提交按鈕');
                        }
                    } else {
                        console.log('❌ 找不到備註輸入框');
                    }
                } else {
                    console.log('❌ Modal 未成功打開');
                }
            } else {
                console.log('❌ 找不到可點擊的案場元素');
            }
            
        } else {
            console.log('❌ 未成功跳轉到專案列表，當前 URL:', page.url());
        }
        
        // 截圖
        await page.screenshot({ path: 'debug-site-writing.png', fullPage: true });
        console.log('✅ 調試截圖已保存');
        
    } catch (error) {
        console.error('❌ 調試過程發生錯誤:', error);
        await page.screenshot({ path: 'debug-error.png', fullPage: true });
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

debugSiteWriting();