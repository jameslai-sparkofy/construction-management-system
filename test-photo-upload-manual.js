/**
 * 手動測試照片上傳功能
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testPhotoUploadManual() {
    console.log('📸 手動測試照片上傳功能');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 2000
    });
    const page = await browser.newPage();
    
    try {
        // 監聽所有網路請求
        const allRequests = [];
        page.on('request', request => {
            allRequests.push({
                url: request.url(),
                method: request.method(),
                type: request.resourceType()
            });
            
            if (request.url().includes('upload') || request.url().includes('files')) {
                console.log('📤 上傳請求:', {
                    url: request.url(),
                    method: request.method(),
                    headers: Object.keys(request.headers())
                });
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('upload') || response.url().includes('files')) {
                console.log('📥 上傳回應:', {
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText()
                });
            }
        });
        
        // 監聽 console
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('upload') || text.includes('Upload') || text.includes('上傳')) {
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
        
        // 3. 檢查 uploadPhoto 函數是否存在
        const functionCheck = await page.evaluate(() => {
            return {
                uploadPhotoExists: typeof window.uploadPhoto === 'function',
                uploadToR2Exists: typeof window.uploadToR2 === 'function',
                workerApiUrl: window.WORKER_API_URL,
                jwtToken: window.JWT_TOKEN ? 'EXISTS' : 'MISSING'
            };
        });
        
        console.log('函數檢查:', functionCheck);
        
        // 4. 點擊案場開啟 Modal
        console.log('4. 點擊案場開啟 Modal...');
        const siteElements = await page.$$('.grid-cell, td[onclick*="openSiteModal"]');
        if (siteElements.length > 0) {
            await siteElements[0].click();
            await page.waitForTimeout(3000);
            
            // 5. 手動觸發照片上傳
            console.log('5. 手動觸發照片上傳...');
            
            // 創建測試圖片
            const testImageContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#4F46E5"/>
                <text x="50" y="100" fill="white" font-size="20">Test Photo</text>
                <text x="60" y="130" fill="white" font-size="16">${new Date().toLocaleTimeString()}</text>
            </svg>`;
            
            const testImagePath = path.join(process.cwd(), 'test-upload-image.svg');
            fs.writeFileSync(testImagePath, testImageContent);
            
            // 手動呼叫 uploadPhoto 函數
            const uploadResult = await page.evaluate(async (imagePath) => {
                try {
                    // 檢查函數是否存在
                    if (typeof window.uploadPhoto !== 'function') {
                        return { success: false, error: 'uploadPhoto function not found' };
                    }
                    
                    // 創建一個模擬的文件輸入
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    
                    // 模擬點擊上傳按鈕
                    window.uploadPhoto('before');
                    
                    return { success: true, message: 'uploadPhoto called successfully' };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }, testImagePath);
            
            console.log('手動上傳結果:', uploadResult);
            
            // 6. 等待並檢查是否出現文件選擇對話框
            console.log('6. 等待文件選擇對話框...');
            await page.waitForTimeout(2000);
            
            // 7. 嘗試直接測試 uploadToR2 API
            console.log('7. 直接測試 uploadToR2 API...');
            
            const directApiTest = await page.evaluate(async () => {
                try {
                    // 創建一個模擬文件
                    const blob = new Blob(['test image content'], { type: 'image/svg+xml' });
                    const file = new File([blob], 'test.svg', { type: 'image/svg+xml' });
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    const workerApiUrl = window.CONFIG?.API?.WORKER_API_URL;
                    const jwtToken = localStorage.getItem('token');
                    
                    console.log('Testing API:', `${workerApiUrl}/api/v1/files/upload`);
                    console.log('Using JWT:', jwtToken?.substring(0, 20) + '...');
                    
                    const response = await fetch(`${workerApiUrl}/api/v1/files/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${jwtToken}`
                        },
                        body: formData
                    });
                    
                    const responseText = await response.text();
                    
                    return {
                        success: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        response: responseText,
                        apiUrl: `${workerApiUrl}/api/v1/files/upload`
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            console.log('直接 API 測試結果:', directApiTest);
            
            // 清理測試文件
            if (fs.existsSync(testImagePath)) {
                fs.unlinkSync(testImagePath);
            }
        }
        
        // 截圖
        await page.screenshot({ path: 'photo-upload-manual-test.png', fullPage: true });
        console.log('✅ 測試截圖已保存');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error);
        await page.screenshot({ path: 'photo-upload-manual-error.png', fullPage: true });
    } finally {
        console.log('\n📋 手動照片上傳測試完成！');
        console.log('瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

testPhotoUploadManual();