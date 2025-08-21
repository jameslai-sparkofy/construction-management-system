/**
 * 簡化版 Worker API 測試
 */

async function testWorkerAPI() {
    console.log('🧪 測試 Worker API 寫入能力');
    
    const workerApiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
    const testSiteId = '677633f67f855e00016ff02c';
    const token = 'dev-token'; // 使用開發令牌
    
    try {
        // 1. 測試健康檢查
        console.log('1. 測試健康檢查...');
        const healthResponse = await fetch(`${workerApiUrl}/health`);
        console.log('健康檢查:', healthResponse.status, await healthResponse.text());
        
        // 2. 測試讀取案場資料（使用 CRM API）
        console.log('2. 測試讀取案場資料...');
        const readResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?limit=3`, {
            headers: {
                'Authorization': 'Bearer fx-crm-api-secret-2025'
            }
        });
        
        if (readResponse.ok) {
            const readData = await readResponse.json();
            console.log(`讀取成功，找到 ${readData.results?.length || 0} 個案場`);
            
            if (readData.results?.length > 0) {
                const testSite = readData.results[0];
                console.log('測試案場:', {
                    id: testSite._id,
                    building: testSite.Building__c,
                    unit: testSite.unit__c
                });
                
                // 3. 測試 Worker API 寫入
                console.log('3. 測試 Worker API 寫入...');
                
                const updateData = {
                    field_before_notes__c: `API測試 - ${new Date().toLocaleString()}`
                };
                
                const updateResponse = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSite._id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });
                
                console.log('寫入響應狀態:', updateResponse.status);
                const updateResult = await updateResponse.text();
                console.log('寫入結果:', updateResult);
                
                if (updateResponse.ok) {
                    console.log('✅ Worker API 寫入成功！');
                } else {
                    console.log('❌ Worker API 寫入失敗');
                    
                    // 分析錯誤
                    if (updateResponse.status === 401) {
                        console.log('🔐 可能是認證問題');
                    } else if (updateResponse.status === 404) {
                        console.log('📍 可能是路由不存在');
                    } else if (updateResponse.status === 500) {
                        console.log('💥 伺服器內部錯誤');
                    }
                }
            }
        } else {
            console.log('❌ 讀取案場失敗:', readResponse.status);
        }
        
    } catch (error) {
        console.error('❌ 測試錯誤:', error);
    }
}

// 執行測試
testWorkerAPI();