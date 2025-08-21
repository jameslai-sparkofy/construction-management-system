/**
 * 使用正確欄位名稱測試 Worker API
 */

async function testWithCorrectField() {
    console.log('🔧 使用正確欄位名稱測試 Worker API');
    
    const workerApiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
    
    try {
        // 1. 登入獲取 token
        console.log('1. 登入獲取認證 token...');
        
        const loginResponse = await fetch(`${workerApiUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '0912345678', password: '678' })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`登入失敗: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.data?.token;
        
        if (!token) {
            throw new Error('無法獲取認證 token');
        }
        
        console.log('✅ 登入成功，Token:', token.substring(0, 30) + '...');
        
        // 2. 獲取測試案場
        console.log('2. 獲取測試案場資料...');
        
        const readResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?limit=1`, {
            headers: { 'Authorization': 'Bearer fx-crm-api-secret-2025' }
        });
        
        if (!readResponse.ok) {
            throw new Error(`讀取案場失敗: ${readResponse.status}`);
        }
        
        const readData = await readResponse.json();
        if (!readData.results?.length) {
            throw new Error('沒有找到測試案場');
        }
        
        const testSite = readData.results[0];
        console.log('✅ 測試案場:', testSite._id);
        
        // 3. 使用正確欄位名稱測試更新
        console.log('3. 使用正確欄位名稱測試更新...');
        
        const updateData = {
            'field_sF6fn__c': `正確欄位測試 - ${new Date().toLocaleString()}`,  // 施工前備註 - 正確欄位
            'construction_completed__c': false  // 施工完成狀態
        };
        
        console.log('更新資料:', updateData);
        
        const updateResponse = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSite._id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        console.log('更新響應狀態:', updateResponse.status);
        const updateResult = await updateResponse.text();
        console.log('更新結果:', updateResult);
        
        if (updateResponse.ok) {
            console.log('✅ 正確欄位名稱更新成功！');
            
            // 4. 驗證更新結果
            console.log('4. 驗證更新結果...');
            
            setTimeout(async () => {
                try {
                    const verifyResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?_id=${testSite._id}`, {
                        headers: { 'Authorization': 'Bearer fx-crm-api-secret-2025' }
                    });
                    
                    if (verifyResponse.ok) {
                        const verifyData = await verifyResponse.json();
                        const updatedSite = verifyData.results?.[0];
                        console.log('✅ 驗證成功 - 施工前備註:', updatedSite?.field_sF6fn__c);
                        console.log('✅ 驗證成功 - 施工完成:', updatedSite?.construction_completed__c);
                    }
                } catch (error) {
                    console.error('驗證失敗:', error);
                }
            }, 3000);
            
        } else {
            console.log('❌ 更新失敗');
            
            // 分析錯誤
            if (updateResponse.status === 404) {
                console.log('🔍 404 錯誤：檢查 Worker API 路由');
                
                // 5. 測試可能的正確路由
                console.log('5. 測試可能的正確路由...');
                
                const possibleRoutes = [
                    '/api/v1/sites',
                    '/api/v1/crm/sites',
                    '/crm/object_8W9cb__c',
                    '/d1/object_8W9cb__c'
                ];
                
                for (const route of possibleRoutes) {
                    try {
                        const testResponse = await fetch(`${workerApiUrl}${route}/${testSite._id}`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(updateData)
                        });
                        
                        console.log(`路由 ${route}:`, testResponse.status);
                        
                        if (testResponse.ok) {
                            console.log(`✅ 找到正確路由: ${route}`);
                            break;
                        }
                    } catch (error) {
                        console.log(`路由 ${route}: ERROR`);
                    }
                }
            } else if (updateResponse.status === 500) {
                console.log('💥 500 錯誤：Worker 內部錯誤');
                try {
                    const errorData = JSON.parse(updateResult);
                    console.log('錯誤詳情:', errorData);
                } catch (e) {
                    console.log('無法解析錯誤回應');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 測試錯誤:', error);
    }
}

// 執行測試
testWithCorrectField();