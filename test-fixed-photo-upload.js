/**
 * 測試修復後的照片上傳功能
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testFixedPhotoUpload() {
    console.log('📸 測試修復後的照片上傳功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 2000
    });
    const page = await browser.newPage();
    
    try {
        // 監聽上傳相關請求
        const uploadRequests = [];
        page.on('request', request => {
            if (request.url().includes('upload') || request.url().includes('files')) {
                uploadRequests.push({
                    url: request.url(),
                    method: request.method(),
                    type: 'request'
                });
                console.log('📤 上傳請求:', request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('upload') || response.url().includes('files')) {
                uploadRequests.push({
                    url: response.url(),
                    status: response.status(),
                    type: 'response'
                });
                console.log('📥 上傳回應:', response.url(), response.status());
            }
        });
        
        // 監聽 console
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Upload') || text.includes('upload') || text.includes('上傳')) {
                console.log('📝 Console:', text);
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
        
        // 2. 進入專案詳情頁面
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        // 3. 點擊案場開啟 Modal
        console.log('3. 點擊案場開啟 Modal...');
        const siteElements = await page.$$('.grid-cell, td[onclick*="openSiteModal"]');
        if (siteElements.length > 0) {
            await siteElements[0].click();
            await page.waitForTimeout(3000);
            
            // 4. 檢查參數是否正確設置
            const paramCheck = await page.evaluate(() => {
                return {
                    projectId: new URLSearchParams(window.location.search).get('id'),
                    currentSiteId: window.currentSiteId,
                    getProjectIdFromUrl: typeof window.getProjectIdFromUrl === 'function' ? window.getProjectIdFromUrl() : 'FUNCTION_NOT_FOUND',
                    uploadToR2Exists: typeof window.uploadToR2 === 'function',
                    uploadPhotoExists: typeof window.uploadPhoto === 'function'
                };
            });
            
            console.log('參數檢查:', paramCheck);
            
            if (paramCheck.projectId && paramCheck.currentSiteId) {
                // 5. 創建測試圖片
                console.log('5. 創建測試圖片...');
                
                const testImageContent = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="300" height="200" fill="#10B981"/>
                    <text x="20" y="50" fill="white" font-size="24" font-weight="bold">Test Upload</text>
                    <text x="20" y="80" fill="white" font-size="16">Project: ${paramCheck.projectId}</text>
                    <text x="20" y="110" fill="white" font-size="16">Site: ${paramCheck.currentSiteId}</text>
                    <text x="20" y="140" fill="white" font-size="14">${new Date().toLocaleString()}</text>
                </svg>`;
                
                const testImagePath = path.join(process.cwd(), 'test-fixed-upload.svg');
                fs.writeFileSync(testImagePath, testImageContent);
                
                // 6. 直接測試 uploadToR2 API
                console.log('6. 直接測試 uploadToR2 API...');
                
                const directApiTest = await page.evaluate(async (projectId, siteId) => {
                    try {
                        // 創建測試文件
                        const blob = new Blob([`<svg><text>API Test ${Date.now()}</text></svg>`], { type: 'image/svg+xml' });
                        const file = new File([blob], 'api-test.svg', { type: 'image/svg+xml' });
                        
                        // 直接呼叫 uploadToR2
                        const result = await window.uploadToR2(file, 'before');
                        
                        return {
                            success: !!result,
                            url: result,
                            message: 'Direct API test completed'
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                }, paramCheck.projectId, paramCheck.currentSiteId);
                
                console.log('直接 API 測試結果:', directApiTest);
                
                if (directApiTest.success) {
                    console.log('🎉 照片上傳 API 修復成功！');
                    
                    // 7. 測試完整的 UI 流程
                    console.log('7. 測試完整的 UI 流程...');
                    
                    // 點擊 "+" 按鈕觸發上傳
                    const addPhotoButton = await page.$('#beforePhotos .add-photo');
                    if (addPhotoButton) {
                        console.log('點擊施工前照片上傳按鈕...');
                        await addPhotoButton.click();
                        await page.waitForTimeout(1000);
                        
                        // 上傳文件 (Playwright 會自動處理文件選擇對話框)
                        const fileInput = await page.$('input[type="file"]');
                        if (fileInput) {
                            await fileInput.setInputFiles(testImagePath);
                            await page.waitForTimeout(5000);
                            
                            // 檢查是否成功上傳
                            const uploadCheck = await page.evaluate(() => {
                                const beforePhotosContainer = document.getElementById('beforePhotos');
                                const images = beforePhotosContainer.querySelectorAll('img:not(.add-photo)');
                                
                                return {
                                    imageCount: images.length,
                                    firstImageSrc: images[0]?.src || null,
                                    containerHTML: beforePhotosContainer.innerHTML.substring(0, 200)
                                };
                            });
                            
                            console.log('UI 上傳檢查:', uploadCheck);
                            
                            if (uploadCheck.imageCount > 0) {
                                console.log('🎉 完整照片上傳流程測試成功！');
                                
                                // 8. 測試提交功能
                                console.log('8. 測試包含照片的完整提交...');
                                
                                await page.fill('#notesInput', '照片上傳修復測試');
                                
                                let submitResult = null;
                                page.on('dialog', async dialog => {
                                    submitResult = dialog.message();
                                    console.log(`📩 提交結果: ${submitResult}`);
                                    await dialog.accept();
                                });
                                
                                const submitButton = await page.$('button.btn-submit');
                                if (submitButton) {
                                    await submitButton.click();
                                    await page.waitForTimeout(8000);
                                    
                                    if (submitResult && submitResult.includes('成功')) {
                                        console.log('🎉 包含照片的完整提交測試成功！');
                                    } else {
                                        console.log('⚠️ 提交可能有問題:', submitResult);
                                    }
                                }
                            } else {
                                console.log('❌ UI 上傳失敗');
                            }
                        } else {
                            console.log('❌ 找不到文件輸入框');
                        }
                    } else {
                        console.log('❌ 找不到上傳按鈕');
                    }
                } else {
                    console.log('❌ API 上傳仍然失敗:', directApiTest.error);
                }
                
                // 清理測試文件
                if (fs.existsSync(testImagePath)) {
                    fs.unlinkSync(testImagePath);
                }
            } else {
                console.log('❌ 缺少必要參數:', paramCheck);
            }
        } else {
            console.log('❌ 找不到案場元素');
        }
        
        console.log('\n📊 上傳請求總結:');
        uploadRequests.forEach((req, i) => {
            console.log(`  ${i + 1}. ${req.type.toUpperCase()}: ${req.url} ${req.status || req.method}`);
        });
        
        // 截圖
        await page.screenshot({ path: 'fixed-photo-upload-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'fixed-photo-upload-error.png', fullPage: true });
    } finally {
        console.log('\n📋 修復後照片上傳測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testFixedPhotoUpload();