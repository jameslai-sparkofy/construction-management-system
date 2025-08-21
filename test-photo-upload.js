/**
 * 測試照片上傳功能
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testPhotoUpload() {
    console.log('📸 測試照片上傳功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽網路請求
        const uploadRequests = [];
        page.on('request', request => {
            if (request.url().includes('upload') || request.url().includes('files')) {
                uploadRequests.push({
                    url: request.url(),
                    method: request.method(),
                    headers: Object.keys(request.headers())
                });
                console.log('📤 上傳請求:', request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('upload') || response.url().includes('files')) {
                console.log('📥 上傳回應:', response.url(), response.status());
            }
        });
        
        // 監聽錯誤
        page.on('console', msg => {
            if (msg.type() === 'error' && msg.text().includes('upload')) {
                console.log('🚨 上傳錯誤:', msg.text());
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
            
            const modalCheck = await page.evaluate(() => {
                const modal = document.getElementById('siteModal');
                return {
                    modalActive: modal?.classList.contains('active'),
                    hasFileInputs: document.querySelectorAll('input[type="file"]').length
                };
            });
            
            console.log('Modal 檢查:', modalCheck);
            
            if (modalCheck.modalActive) {
                // 4. 檢查照片上傳區域
                console.log('4. 檢查照片上傳區域...');
                
                const photoAreas = await page.evaluate(() => {
                    const areas = [
                        { id: 'floorPlanPhotos', name: '平面圖' },
                        { id: 'beforePhotos', name: '施工前照片' },
                        { id: 'afterPhotos', name: '施工後照片' },
                        { id: 'difficultyPhotos', name: '困難狀況照片' }
                    ];
                    
                    return areas.map(area => ({
                        ...area,
                        exists: !!document.getElementById(area.id),
                        fileInputExists: !!document.querySelector(`#${area.id} input[type="file"]`),
                        uploadButtonExists: !!document.querySelector(`#${area.id} .upload-btn`)
                    }));
                });
                
                console.log('照片區域檢查:', photoAreas);
                
                // 5. 創建測試圖片文件
                console.log('5. 創建測試圖片...');
                
                // 創建一個簡單的測試圖片 (SVG)
                const testImageContent = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="blue"/>
                    <text x="10" y="50" fill="white">Test</text>
                </svg>`;
                
                const testImagePath = path.join(process.cwd(), 'test-image.svg');
                fs.writeFileSync(testImagePath, testImageContent);
                
                // 6. 測試照片上傳
                console.log('6. 測試照片上傳...');
                
                const firstAvailableArea = photoAreas.find(area => area.exists && area.fileInputExists);
                if (firstAvailableArea) {
                    console.log(`測試上傳到: ${firstAvailableArea.name}`);
                    
                    // 找到文件輸入框
                    const fileInput = await page.$(`#${firstAvailableArea.id} input[type="file"]`);
                    if (fileInput) {
                        // 上傳文件
                        await fileInput.setInputFiles(testImagePath);
                        await page.waitForTimeout(5000);
                        
                        console.log('捕獲的上傳請求:', uploadRequests);
                        
                        // 檢查上傳結果
                        const uploadResult = await page.evaluate((areaId) => {
                            const area = document.getElementById(areaId);
                            const images = area.querySelectorAll('img');
                            const uploadStatus = area.querySelector('.upload-status')?.textContent || '';
                            
                            return {
                                imageCount: images.length,
                                firstImageSrc: images[0]?.src || null,
                                uploadStatus: uploadStatus,
                                hasImages: images.length > 0
                            };
                        }, firstAvailableArea.id);
                        
                        console.log('上傳結果:', uploadResult);
                        
                        if (uploadResult.hasImages) {
                            console.log('✅ 照片上傳成功！');
                            
                            // 7. 測試完整提交流程
                            console.log('7. 測試完整提交...');
                            
                            await page.fill('#notesInput', '照片上傳測試');
                            
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
                                    console.log('🎉 完整上傳和提交測試成功！');
                                } else {
                                    console.log('⚠️ 提交可能有問題:', submitResult);
                                }
                            }
                        } else {
                            console.log('❌ 照片上傳失敗');
                            
                            // 檢查上傳 API 配置
                            const apiCheck = await page.evaluate(() => {
                                return {
                                    workerApiUrl: window.CONFIG?.API?.WORKER_API_URL,
                                    jwtToken: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
                                    uploadUrl: `${window.CONFIG?.API?.WORKER_API_URL}/api/v1/files/upload`
                                };
                            });
                            
                            console.log('API 配置檢查:', apiCheck);
                        }
                    } else {
                        console.log('❌ 找不到文件輸入框');
                    }
                } else {
                    console.log('❌ 找不到可用的照片上傳區域');
                }
                
                // 清理測試文件
                if (fs.existsSync(testImagePath)) {
                    fs.unlinkSync(testImagePath);
                }
            } else {
                console.log('❌ Modal 未成功開啟');
            }
        } else {
            console.log('❌ 找不到案場元素');
        }
        
        // 截圖
        await page.screenshot({ path: 'photo-upload-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'photo-upload-error.png', fullPage: true });
    } finally {
        console.log('\n📋 照片上傳測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testPhotoUpload();