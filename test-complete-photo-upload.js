/**
 * 完整測試照片上傳功能 - 包含實際點擊和上傳
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testCompletePhotoUpload() {
    console.log('📸 完整測試照片上傳功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽所有上傳相關請求
        const uploadRequests = [];
        page.on('request', request => {
            if (request.url().includes('upload') || request.url().includes('files') || request.url().includes('construction-photos')) {
                uploadRequests.push({
                    url: request.url(),
                    method: request.method(),
                    type: 'request',
                    headers: Object.keys(request.headers())
                });
                console.log('📤 上傳請求:', request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('upload') || response.url().includes('files') || response.url().includes('construction-photos')) {
                uploadRequests.push({
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText(),
                    type: 'response'
                });
                console.log('📥 上傳回應:', response.url(), response.status());
            }
        });
        
        // 監聽 console 錯誤和訊息
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('upload') || text.includes('Upload') || text.includes('上傳') || text.includes('R2')) {
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
        await page.waitForTimeout(8000);
        
        // 3. 確保案場已載入
        console.log('3. 檢查案場載入狀態...');
        const sitesLoaded = await page.evaluate(() => {
            const siteElements = document.querySelectorAll('.grid-cell, td[onclick*="openSiteModal"]');
            return {
                count: siteElements.length,
                firstSiteId: siteElements[0]?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || null
            };
        });
        
        console.log('案場檢查:', sitesLoaded);
        
        if (sitesLoaded.count === 0) {
            throw new Error('沒有找到任何案場，無法測試');
        }
        
        // 4. 點擊第一個案場
        console.log('4. 點擊第一個案場...');
        const siteElements = await page.$$('.grid-cell[onclick*="openSiteModal"], td[onclick*="openSiteModal"]');
        if (siteElements.length > 0) {
            await siteElements[0].click();
            await page.waitForTimeout(3000);
            
            // 5. 檢查 modal 和參數
            console.log('5. 檢查 Modal 狀態和參數...');
            const modalCheck = await page.evaluate(() => {
                return {
                    modalActive: document.getElementById('siteModal')?.classList.contains('active'),
                    currentSiteId: window.currentSiteId,
                    projectId: new URLSearchParams(window.location.search).get('id'),
                    uploadToR2Exists: typeof window.uploadToR2 === 'function',
                    uploadPhotoExists: typeof window.uploadPhoto === 'function'
                };
            });
            
            console.log('Modal 檢查:', modalCheck);
            
            if (modalCheck.modalActive && modalCheck.currentSiteId) {
                // 6. 創建測試圖片
                console.log('6. 創建測試圖片...');
                const testImageContent = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                    <rect width="400" height="300" fill="#4F46E5"/>
                    <text x="20" y="50" fill="white" font-size="24" font-weight="bold">Photo Upload Test</text>
                    <text x="20" y="80" fill="white" font-size="16">Project: ${modalCheck.projectId}</text>
                    <text x="20" y="110" fill="white" font-size="16">Site: ${modalCheck.currentSiteId}</text>
                    <text x="20" y="140" fill="white" font-size="14">Time: ${new Date().toLocaleString()}</text>
                    <text x="20" y="170" fill="white" font-size="12">This will be uploaded to R2 bucket</text>
                    <text x="20" y="200" fill="white" font-size="12">Path: ${modalCheck.projectId}/${modalCheck.currentSiteId}/before/</text>
                </svg>`;
                
                const testImagePath = path.join(process.cwd(), 'complete-test-upload.svg');
                fs.writeFileSync(testImagePath, testImageContent);
                
                // 7. 測試直接 API 呼叫
                console.log('7. 先測試直接 uploadToR2 API...');
                const directApiTest = await page.evaluate(async (projectId, siteId) => {
                    try {
                        // 創建測試檔案
                        const svgContent = `<svg><text>Direct API Test ${Date.now()}</text></svg>`;
                        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                        const file = new File([blob], 'direct-api-test.svg', { type: 'image/svg+xml' });
                        
                        // 直接呼叫 uploadToR2
                        const result = await window.uploadToR2(file, 'before');
                        
                        return {
                            success: !!result,
                            url: result,
                            message: 'Direct API test completed successfully'
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message,
                            stack: error.stack
                        };
                    }
                }, modalCheck.projectId, modalCheck.currentSiteId);
                
                console.log('直接 API 測試結果:', directApiTest);
                
                if (directApiTest.success) {
                    console.log('🎉 直接 API 呼叫成功！照片已上傳到 R2');
                    console.log('檔案 URL:', directApiTest.url);
                    
                    // 8. 測試透過 UI 上傳
                    console.log('8. 測試透過 UI 上傳...');
                    
                    // 找到施工前照片的上傳按鈕
                    const beforePhotosArea = await page.$('#beforePhotos');
                    if (beforePhotosArea) {
                        // 點擊新增照片按鈕
                        const addPhotoButton = await page.$('#beforePhotos .add-photo, #beforePhotos .upload-btn');
                        if (addPhotoButton) {
                            console.log('點擊新增照片按鈕...');
                            await addPhotoButton.click();
                            await page.waitForTimeout(1000);
                            
                            // 找到文件輸入框並上傳文件
                            const fileInput = await page.$('input[type="file"]');
                            if (fileInput) {
                                console.log('上傳測試圖片文件...');
                                await fileInput.setInputFiles(testImagePath);
                                await page.waitForTimeout(5000);
                                
                                // 檢查上傳結果
                                const uploadResult = await page.evaluate(() => {
                                    const beforePhotosContainer = document.getElementById('beforePhotos');
                                    const images = beforePhotosContainer.querySelectorAll('img:not(.add-photo)');
                                    
                                    return {
                                        imageCount: images.length,
                                        images: Array.from(images).map(img => ({
                                            src: img.src,
                                            alt: img.alt || '',
                                            className: img.className
                                        })),
                                        containerHTML: beforePhotosContainer.innerHTML.substring(0, 500)
                                    };
                                });
                                
                                console.log('UI 上傳結果:', uploadResult);
                                
                                if (uploadResult.imageCount > 0) {
                                    console.log('🎉 UI 上傳成功！照片已顯示在頁面上');
                                    uploadResult.images.forEach((img, i) => {
                                        console.log(`  圖片 ${i+1}: ${img.src}`);
                                    });
                                    
                                    // 9. 完整提交測試
                                    console.log('9. 測試包含照片的完整提交...');
                                    await page.fill('#notesInput', `照片上傳完整測試 - ${new Date().toLocaleString()}`);
                                    
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
                                            console.log('🎉 完整照片上傳和提交流程測試成功！');
                                        } else {
                                            console.log('⚠️ 提交狀態:', submitResult);
                                        }
                                    }
                                } else {
                                    console.log('❌ UI 上傳失敗 - 照片未顯示在頁面上');
                                }
                            } else {
                                console.log('❌ 找不到文件輸入框');
                            }
                        } else {
                            console.log('❌ 找不到新增照片按鈕');
                        }
                    } else {
                        console.log('❌ 找不到施工前照片區域');
                    }
                } else {
                    console.log('❌ 直接 API 呼叫失敗:', directApiTest.error);
                }
                
                // 清理測試文件
                if (fs.existsSync(testImagePath)) {
                    fs.unlinkSync(testImagePath);
                }
            } else {
                console.log('❌ Modal 未正確開啟或缺少必要參數:', modalCheck);
            }
        } else {
            console.log('❌ 找不到可點擊的案場元素');
        }
        
        console.log('\n📊 所有上傳請求記錄:');
        uploadRequests.forEach((req, i) => {
            if (req.type === 'request') {
                console.log(`  ${i + 1}. REQUEST: ${req.method} ${req.url}`);
                console.log(`     Headers: ${req.headers.join(', ')}`);
            } else {
                console.log(`  ${i + 1}. RESPONSE: ${req.status} ${req.statusText} ${req.url}`);
            }
        });
        
        // 截圖
        await page.screenshot({ path: 'complete-photo-upload-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存: complete-photo-upload-test.png');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'complete-photo-upload-error.png', fullPage: true });
    } finally {
        console.log('\n📋 完整照片上傳測試完成！');
        console.log('瀏覽器將保持開啟 90 秒供檢查...');
        setTimeout(() => browser.close(), 90000);
    }
}

testCompletePhotoUpload();