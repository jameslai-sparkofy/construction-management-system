/**
 * 診斷寫入問題
 */

async function diagnoseWriteIssue() {
    console.log('🔍 診斷 Worker API 寫入問題');
    
    const workerApiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
    
    try {
        // 1. 檢查登入 API 回應格式
        console.log('1. 檢查登入 API...');
        
        const loginResponse = await fetch(`${workerApiUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '0912345678', password: '678' })
        });
        
        const loginData = await loginResponse.json();
        console.log('登入回應:', JSON.stringify(loginData, null, 2));
        
        // 2. 檢查可能的 token 欄位
        const possibleTokens = [
            loginData.token,
            loginData.access_token,
            loginData.auth_token,
            loginData.data?.token,
            loginData.user?.token
        ].filter(t => t);
        
        console.log('可能的 tokens:', possibleTokens);
        
        // 3. 測試不同的認證方式
        console.log('2. 測試不同認證方式...');
        
        const testSiteId = '689080ecd748ab000110b892';
        const updateData = { field_before_notes__c: `診斷測試 - ${Date.now()}` };
        
        // 方式 1: 使用找到的 token
        if (possibleTokens.length > 0) {
            console.log('嘗試使用 token:', possibleTokens[0].substring(0, 20) + '...');
            
            const tokenResponse = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSiteId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${possibleTokens[0]}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            console.log('Token 認證結果:', tokenResponse.status, await tokenResponse.text());
        }
        
        // 方式 2: 嘗試開發模式無認證
        console.log('嘗試無認證模式...');
        
        const noAuthResponse = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSiteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        console.log('無認證結果:', noAuthResponse.status, await noAuthResponse.text());
        
        // 方式 3: 使用 dev-token (如 Worker 程式碼中可能的預設值)
        console.log('嘗試 dev-token...');
        
        const devTokenResponse = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSiteId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer dev-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        console.log('dev-token 結果:', devTokenResponse.status, await devTokenResponse.text());
        
        // 4. 檢查 API 路由
        console.log('3. 檢查 API 路由可用性...');
        
        const routeTests = [
            `${workerApiUrl}/rest/object_8W9cb__c`,
            `${workerApiUrl}/api/rest/object_8W9cb__c`,
            `${workerApiUrl}/crm/rest/object_8W9cb__c`
        ];
        
        for (const route of routeTests) {
            try {
                const response = await fetch(route, {
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer dev-token' }
                });
                console.log(`路由 ${route}:`, response.status);
            } catch (error) {
                console.log(`路由 ${route}:`, 'ERROR', error.message);
            }
        }
        
        // 5. 檢查 Worker 是否支援 PATCH 方法
        console.log('4. 檢查支援的 HTTP 方法...');
        
        const methodTests = ['GET', 'POST', 'PUT', 'PATCH'];
        
        for (const method of methodTests) {
            try {
                const response = await fetch(`${workerApiUrl}/rest/object_8W9cb__c/${testSiteId}`, {
                    method,
                    headers: {
                        'Authorization': 'Bearer dev-token',
                        'Content-Type': 'application/json'
                    },
                    body: method !== 'GET' ? JSON.stringify(updateData) : undefined
                });
                console.log(`方法 ${method}:`, response.status);
            } catch (error) {
                console.log(`方法 ${method}:`, 'ERROR');
            }
        }
        
    } catch (error) {
        console.error('❌ 診斷錯誤:', error);
    }
}

// 執行診斷
diagnoseWriteIssue();