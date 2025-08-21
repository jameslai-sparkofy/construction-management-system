/**
 * 測試真實專案的案場寫入功能
 */

const { chromium } = require('playwright');

async function testRealProjectSite() {
    console.log('🎯 測試真實專案案場寫入功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 2000
    });
    const page = await browser.newPage();
    
    try {
        // 1. 登入
        console.log('1. 登入開發環境...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        if (!page.url().includes('project-list')) {
            throw new Error('登入失敗');
        }
        
        console.log('✅ 登入成功');
        
        // 2. 等待專案表格載入
        console.log('2. 等待專案資料載入...');
        await page.waitForSelector('#projectsTableBody tr', { timeout: 15000 });
        
        // 3. 獲取第一個專案的點擊連結
        console.log('3. 獲取專案連結...');
        
        const projectLinks = await page.$$eval('#projectsTableBody tr', rows =>
            rows.map(row => {
                const link = row.querySelector('a, [onclick]');
                return link ? {
                    href: link.href,
                    onclick: link.getAttribute('onclick'),
                    text: row.textContent.trim().substring(0, 50)
                } : null;
            }).filter(item => item)
        );
        
        console.log('找到的專案連結:', projectLinks.slice(0, 3));
        
        if (projectLinks.length === 0) {
            throw new Error('沒有找到任何專案連結');
        }
        
        // 4. 點擊第一個專案
        console.log('4. 點擊第一個專案...');
        const firstProjectRow = await page.$('#projectsTableBody tr');
        
        if (firstProjectRow) {
            await firstProjectRow.click();
            await page.waitForTimeout(3000);
            
            // 檢查是否跳轉到專案詳情頁面
            if (page.url().includes('project-detail')) {
                console.log('✅ 成功跳轉到專案詳情:', page.url());
                
                // 5. 等待專案載入完成（等待錯誤訊息消失或成功載入）
                console.log('5. 等待專案資料載入...');
                
                // 等待載入完成的指標
                await page.waitForFunction(() => {
                    const loadingText = document.querySelector('.loading');
                    const errorText = document.body.textContent.includes('載入專案失敗');
                    const hasGrid = document.querySelectorAll('.grid-cell, .construction-team-info').length > 0;
                    return !loadingText || errorText || hasGrid;
                }, { timeout: 15000 });
                
                // 檢查是否載入成功
                const hasError = await page.evaluate(() => document.body.textContent.includes('載入專案失敗'));
                
                if (hasError) {
                    console.log('❌ 專案載入失敗，嘗試其他專案...');
                    
                    // 回到專案列表嘗試其他專案
                    await page.goBack();
                    await page.waitForTimeout(2000);
                    
                    const secondProjectRow = await page.$('#projectsTableBody tr:nth-child(2)');
                    if (secondProjectRow) {
                        console.log('6. 嘗試第二個專案...');
                        await secondProjectRow.click();
                        await page.waitForTimeout(5000);
                        
                        const hasError2 = await page.evaluate(() => document.body.textContent.includes('載入專案失敗'));
                        if (hasError2) {
                            throw new Error('多個專案都載入失敗，可能是 API 問題');
                        }
                    }
                }
                
                console.log('✅ 專案載入成功');
                
                // 6. 尋找案場並測試寫入
                console.log('6. 尋找案場元素...');
                
                // 等待案場載入
                await page.waitForTimeout(5000);
                
                // 尋找各種可能的案場元素
                const siteSelectors = [
                    '.grid-cell',
                    'td[onclick*="openSiteModal"]',
                    '[onclick*="openSiteModal"]',
                    'td.cell'
                ];
                
                let siteElement = null;
                for (const selector of siteSelectors) {
                    siteElement = await page.$(selector);
                    if (siteElement) {
                        console.log(`✅ 找到案場元素: ${selector}`);
                        break;
                    }
                }
                
                if (siteElement) {
                    console.log('7. 點擊案場開啟 Modal...');
                    await siteElement.click();
                    await page.waitForTimeout(3000);
                    
                    // 檢查 Modal 是否打開
                    const modalActive = await page.$('#siteModal.active');
                    if (modalActive) {
                        console.log('✅ 案場 Modal 已打開');
                        
                        // 8. 測試寫入功能
                        console.log('8. 測試案場資料寫入...');
                        
                        const testNote = `Playwright 實際測試 - ${new Date().toLocaleString('zh-TW')}`;
                        
                        // 填寫施工前備註
                        const notesInput = await page.$('#notesInput');
                        if (notesInput) {
                            await page.fill('#notesInput', testNote);
                            console.log(`✅ 已填寫施工前備註: ${testNote}`);
                            
                            // 監聽提交結果
                            let submitResult = null;
                            page.on('dialog', async dialog => {
                                submitResult = dialog.message();
                                console.log(`收到提交結果: ${submitResult}`);
                                await dialog.accept();
                            });
                            
                            // 提交更新
                            console.log('9. 提交案場更新...');
                            const submitButton = await page.$('button.btn-submit, .btn-submit');
                            if (submitButton) {
                                await submitButton.click();
                                
                                // 等待響應
                                await page.waitForTimeout(8000);
                                
                                if (submitResult) {
                                    if (submitResult.includes('成功')) {
                                        console.log('🎉 案場資料寫入測試成功！');
                                        
                                        // 10. 驗證寫入結果
                                        console.log('10. 驗證寫入結果...');
                                        
                                        // 關閉 Modal 並重新打開驗證
                                        await page.click('.modal-close, .btn-cancel');
                                        await page.waitForTimeout(2000);
                                        
                                        await siteElement.click();
                                        await page.waitForTimeout(3000);
                                        
                                        const verifyNotes = await page.inputValue('#notesInput');
                                        if (verifyNotes === testNote) {
                                            console.log('✅ 驗證成功：資料已正確保存到資料庫');
                                        } else {
                                            console.log(`⚠️ 驗證異常：期望 "${testNote}"，實際 "${verifyNotes}"`);
                                        }
                                        
                                    } else {
                                        console.log(`❌ 寫入失敗: ${submitResult}`);
                                    }
                                } else {
                                    console.log('⚠️ 沒有收到提交結果回應');
                                }
                            } else {
                                console.log('❌ 找不到提交按鈕');
                            }
                        } else {
                            console.log('❌ 找不到施工前備註輸入框');
                        }
                    } else {
                        console.log('❌ 案場 Modal 未成功打開');
                    }
                } else {
                    console.log('❌ 沒有找到任何案場元素');
                    
                    // 列出頁面上的所有元素供參考
                    const allElements = await page.$$eval('*', elements =>
                        elements.filter(el => el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 50)
                            .slice(0, 10)
                            .map(el => ({
                                tag: el.tagName,
                                class: el.className,
                                text: el.textContent.trim()
                            }))
                    );
                    console.log('頁面元素樣本:', allElements);
                }
                
            } else {
                console.log('❌ 未成功跳轉到專案詳情頁面，當前 URL:', page.url());
            }
        } else {
            console.log('❌ 找不到第一個專案行');
        }
        
        // 截圖記錄
        await page.screenshot({ path: 'real-project-site-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'real-project-error.png', fullPage: true });
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testRealProjectSite();