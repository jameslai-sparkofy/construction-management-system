/**
 * 測試完整的照片功能：上傳、顯示、刪除
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testCompletePhotoFeatures() {
    console.log('📸 測試完整照片功能：上傳、顯示、刪除');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1500
    });
    const page = await browser.newPage();
    
    try {
        // 監聽所有網路請求
        const networkLog = [];
        page.on('request', request => {
            if (request.url().includes('files') || request.url().includes('upload')) {
                networkLog.push({
                    type: 'request',
                    url: request.url(),
                    method: request.method()
                });
                console.log('📤 Request:', request.method(), request.url());
            }
        });
        
        page.on('response', async response => {
            if (response.url().includes('files') || response.url().includes('upload')) {
                let body = '';
                try {
                    body = await response.text();
                } catch (e) {
                    body = 'Binary data';
                }
                networkLog.push({
                    type: 'response',
                    url: response.url(),
                    status: response.status(),
                    body: body.substring(0, 200)
                });
                console.log('📥 Response:', response.status(), response.url());
                if (body && body.length < 200) {
                    console.log('   Body:', body);
                }
            }
        });
        
        // 監聽 console
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('R2') || text.includes('upload') || text.includes('photo') || text.includes('file')) {
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
        
        // 2. 進入專案詳情頁面
        console.log('2. 進入專案詳情頁面...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755783317062');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(8000);
        
        // 3. 點擊第一個案場開啟 Modal
        console.log('3. 點擊案場開啟 Modal...');
        const siteElements = await page.$$('.grid-cell[onclick*="openSiteModal"], td[onclick*="openSiteModal"]');
        if (siteElements.length === 0) {
            throw new Error('找不到案場元素');
        }
        
        await siteElements[0].click();
        await page.waitForTimeout(3000);
        
        // 4. 檢查 Modal 和參數
        console.log('4. 檢查 Modal 狀態...');
        const modalCheck = await page.evaluate(() => {
            return {
                modalActive: document.getElementById('siteModal')?.classList.contains('active'),
                currentSiteId: window.currentSiteId,
                projectId: new URLSearchParams(window.location.search).get('id'),
                functionsExist: {
                    uploadToR2: typeof window.uploadToR2 === 'function',
                    uploadPhoto: typeof window.uploadPhoto === 'function',
                    loadR2Photos: typeof window.loadR2Photos === 'function',
                    addR2PhotoToContainer: typeof window.addR2PhotoToContainer === 'function',
                    deleteR2Photo: typeof window.deleteR2Photo === 'function'
                }
            };
        });
        
        console.log('Modal 狀態:', modalCheck);
        
        if (!modalCheck.modalActive) {
            throw new Error('Modal 未正確開啟');
        }
        
        // 5. 檢查是否載入了現有的 R2 照片
        console.log('5. 檢查是否載入現有照片...');
        await page.waitForTimeout(3000); // 等待 loadR2Photos 完成
        
        const existingPhotos = await page.evaluate(() => {
            const containers = ['beforePhotos', 'afterPhotos', 'difficultyPhotos', 'floorPlanPhotos'];
            const result = {};
            
            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                const photos = container?.querySelectorAll('.photo-box:not(.add-photo)') || [];
                result[containerId] = {
                    count: photos.length,
                    photos: Array.from(photos).map(photo => ({
                        src: photo.querySelector('img')?.src || 'no-img',
                        hasDeleteBtn: !!photo.querySelector('.photo-delete-btn')
                    }))
                };
            });
            
            return result;
        });
        
        console.log('現有照片狀況:', existingPhotos);
        
        // 6. 上傳新照片
        console.log('6. 上傳新的測試照片...');
        
        // 創建測試圖片
        const testImageContent = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="200" fill="#22C55E"/>
            <text x="20" y="50" fill="white" font-size="20" font-weight="bold">Test Photo Upload</text>
            <text x="20" y="80" fill="white" font-size="14">Time: ${new Date().toLocaleString()}</text>
            <text x="20" y="110" fill="white" font-size="12">Testing complete photo features</text>
            <text x="20" y="140" fill="white" font-size="12">Upload → Display → Delete</text>
        </svg>`;
        
        const testImagePath = path.join(process.cwd(), 'test-photo-features.svg');
        fs.writeFileSync(testImagePath, testImageContent);
        
        // 點擊施工前照片上傳按鈕
        const beforePhotosContainer = await page.$('#beforePhotos');
        if (!beforePhotosContainer) {
            throw new Error('找不到施工前照片容器');
        }
        
        const addPhotoButton = await page.$('#beforePhotos .add-photo');
        if (!addPhotoButton) {
            throw new Error('找不到新增照片按鈕');
        }
        
        console.log('點擊新增照片按鈕...');
        await addPhotoButton.click();
        await page.waitForTimeout(1000);
        
        // 上傳文件
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
            throw new Error('找不到文件輸入框');
        }
        
        console.log('上傳測試圖片...');
        await fileInput.setInputFiles(testImagePath);
        await page.waitForTimeout(5000); // 等待上傳完成
        
        // 7. 檢查上傳後的照片是否顯示
        console.log('7. 檢查上傳後的照片...');
        const afterUpload = await page.evaluate(() => {
            const container = document.getElementById('beforePhotos');
            const photos = container?.querySelectorAll('.photo-box:not(.add-photo)') || [];
            
            return {
                photoCount: photos.length,
                photos: Array.from(photos).map((photo, index) => ({
                    index,
                    src: photo.querySelector('img')?.src || 'no-img',
                    hasDeleteBtn: !!photo.querySelector('.photo-delete-btn'),
                    deleteVisible: photo.querySelector('.photo-delete-btn')?.style.display !== 'none'
                }))
            };
        });
        
        console.log('上傳後照片狀態:', afterUpload);
        
        if (afterUpload.photoCount === 0) {
            console.log('❌ 照片上傳失敗或未顯示');
        } else {
            console.log('✅ 照片上傳成功並顯示');
            
            // 8. 測試照片刪除功能
            console.log('8. 測試照片刪除功能...');
            
            // 滑鼠懸停在第一張照片上
            const firstPhoto = await page.$('#beforePhotos .photo-box:not(.add-photo)');
            if (firstPhoto) {
                console.log('滑鼠懸停顯示刪除按鈕...');
                await firstPhoto.hover();
                await page.waitForTimeout(1000);
                
                // 檢查刪除按鈕是否顯示
                const deleteButtonVisible = await page.evaluate(() => {
                    const deleteBtn = document.querySelector('#beforePhotos .photo-box:not(.add-photo) .photo-delete-btn');
                    return deleteBtn && deleteBtn.style.display !== 'none';
                });
                
                console.log('刪除按鈕顯示狀態:', deleteButtonVisible);
                
                if (deleteButtonVisible) {
                    // 點擊刪除按鈕
                    console.log('點擊刪除按鈕...');
                    
                    // 監聽確認對話框
                    let dialogHandled = false;
                    page.on('dialog', async dialog => {
                        console.log('🗨️ 確認對話框:', dialog.message());
                        await dialog.accept();
                        dialogHandled = true;
                    });
                    
                    const deleteButton = await page.$('#beforePhotos .photo-box:not(.add-photo) .photo-delete-btn');
                    if (deleteButton) {
                        await deleteButton.click();
                        await page.waitForTimeout(3000); // 等待刪除完成
                        
                        // 檢查照片是否被刪除
                        const afterDelete = await page.evaluate(() => {
                            const container = document.getElementById('beforePhotos');
                            const photos = container?.querySelectorAll('.photo-box:not(.add-photo)') || [];
                            return { photoCount: photos.length };
                        });
                        
                        console.log('刪除後照片數量:', afterDelete.photoCount);
                        
                        if (afterDelete.photoCount < afterUpload.photoCount) {
                            console.log('✅ 照片刪除成功');
                        } else {
                            console.log('❌ 照片刪除失敗');
                        }
                    }
                } else {
                    console.log('⚠️ 刪除按鈕未顯示');
                }
            }
        }
        
        // 清理測試文件
        if (fs.existsSync(testImagePath)) {
            fs.unlinkSync(testImagePath);
        }
        
        console.log('\n📊 網路請求記錄:');
        networkLog.forEach((log, i) => {
            console.log(`${i + 1}. ${log.type.toUpperCase()}: ${log.method || log.status} ${log.url}`);
            if (log.body && log.body !== 'Binary data') {
                console.log(`   Response: ${log.body}`);
            }
        });
        
        // 截圖
        await page.screenshot({ path: 'complete-photo-features-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'photo-features-error.png', fullPage: true });
    } finally {
        console.log('\n📋 完整照片功能測試完成！');
        console.log('瀏覽器將保持開啟 90 秒供檢查...');
        setTimeout(() => browser.close(), 90000);
    }
}

testCompletePhotoFeatures();