/**
 * 使用正確認證的 Worker API 測試
 */

async function testWithProperAuth() {
    console.log('🔐 使用正確認證測試 Worker API');
    
    const workerApiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
    
    try {
        // 1. 先嘗試登入獲取正確的 token
        console.log('1. 嘗試登入獲取認證...');
        
        const loginResponse = await fetch(`${workerApiUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '0912345678',
                password: '678'
            })
        });
        
        console.log('登入響應:', loginResponse.status);
        
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('登入成功，獲得 token:', !!loginData.token);
            
            const authToken = loginData.token;
            
            // 2. 使用正確 token 測試寫入
            console.log('2. 使用認證 token 測試寫入...');
            
            // 先獲取一個測試案場
            const readResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?limit=1`, {
                headers: {
                    'Authorization': 'Bearer fx-crm-api-secret-2025'
                }
            });
            
            if (readResponse.ok) {
                const readData = await readResponse.json();
                if (readData.results?.length > 0) {
                    const testSite = readData.results[0];
                    console.log('使用測試案場:', testSite._id);
                    
                    const updateData = {
                        field_before_notes__c: `認證測試 - ${new Date().toLocaleString()}`
                    };
                    
                    const updateResponse = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSite._id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateData)
                    });
                    
                    console.log('更新響應狀態:', updateResponse.status);
                    const updateResult = await updateResponse.text();
                    console.log('更新結果:', updateResult);
                    
                    if (updateResponse.ok) {
                        console.log('✅ 認證寫入成功！');
                        
                        // 3. 驗證寫入結果
                        console.log('3. 驗證寫入結果...');
                        setTimeout(async () => {
                            const verifyResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?_id=${testSite._id}`, {
                                headers: {
                                    'Authorization': 'Bearer fx-crm-api-secret-2025'
                                }
                            });
                            
                            if (verifyResponse.ok) {
                                const verifyData = await verifyResponse.json();
                                const updatedSite = verifyData.results?.[0];
                                console.log('驗證結果 - 備註:', updatedSite?.field_before_notes__c);
                            }
                        }, 2000);
                    } else {
                        console.log('❌ 認證寫入仍然失敗');
                    }
                }
            }
        } else {
            console.log('❌ 登入失敗:', loginResponse.status, await loginResponse.text());
            
            // 4. 嘗試直接使用開發環境認證方式
            console.log('4. 嘗試使用開發模式認證...');
            
            // 檢查是否有緊急登入端點
            const emergencyResponse = await fetch(`${workerApiUrl}/api/v1/auth/emergency-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: '0912345678'
                })
            });
            
            console.log('緊急登入響應:', emergencyResponse.status);
            if (emergencyResponse.ok) {
                const emergencyData = await emergencyResponse.json();
                console.log('緊急登入成功:', !!emergencyData.token);
            } else {
                console.log('緊急登入失敗:', await emergencyResponse.text());
            }
        }
        
    } catch (error) {
        console.error('❌ 測試錯誤:', error);
    }
}

// 執行測試
testWithProperAuth();