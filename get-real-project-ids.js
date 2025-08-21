/**
 * 獲取真實的專案 ID
 */

async function getRealProjectIds() {
    console.log('🔍 獲取真實專案 ID');
    
    const workerApiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
    
    try {
        // 1. 登入獲取 token
        console.log('1. 登入獲取 token...');
        
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
        
        console.log('✅ 登入成功');
        
        // 2. 獲取專案列表
        console.log('2. 獲取專案列表...');
        
        const projectsResponse = await fetch(`${workerApiUrl}/api/v1/projects`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!projectsResponse.ok) {
            throw new Error(`獲取專案列表失敗: ${projectsResponse.status}`);
        }
        
        const projectsData = await projectsResponse.json();
        console.log('專案 API 回應:', JSON.stringify(projectsData, null, 2));
        
        // 3. 嘗試其他可能的端點
        const alternativeEndpoints = [
            '/api/v1/project/list',
            '/projects',
            '/api/projects'
        ];
        
        for (const endpoint of alternativeEndpoints) {
            try {
                console.log(`測試端點: ${endpoint}`);
                const response = await fetch(`${workerApiUrl}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                console.log(`${endpoint}: ${response.status}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`${endpoint} 回應:`, JSON.stringify(data, null, 2));
                }
            } catch (error) {
                console.log(`${endpoint}: ERROR`);
            }
        }
        
        // 4. 直接從前端 localStorage 或 API 獲取
        console.log('3. 檢查是否有其他專案資料源...');
        
        // 嘗試獲取用戶資料，可能包含專案資訊
        const userResponse = await fetch(`${workerApiUrl}/api/v1/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('用戶資料:', JSON.stringify(userData, null, 2));
        }
        
    } catch (error) {
        console.error('❌ 錯誤:', error);
    }
}

// 執行
getRealProjectIds();