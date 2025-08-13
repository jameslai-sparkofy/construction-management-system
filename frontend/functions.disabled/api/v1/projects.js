// Cloudflare Pages Functions API for Projects
// 處理 /api/v1/projects 的 GET 和 POST 請求

export async function onRequestGet(context) {
    try {
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        };

        // 模擬從儲存中獲取專案列表  
        // 在實際環境中，這裡會從 KV 或 D1 資料庫讀取
        // 部署時間: 2025-08-10 (API修復版)
        const projects = [
            {
                id: '650fe201d184e50001102aee',
                name: '勝興-興安西-2024',
                opportunity_id: '650fe201d184e50001102aee',
                company: '勝興建設股份有限公司',
                engineeringTypes: ['SPC', 'CABINET'],
                status: 'active',
                progress: 15,
                unit_count: 224,
                completed_count: 34,
                lastUpdate: new Date().toLocaleDateString('zh-TW'),
                created_at: new Date().toISOString(),
                stats: {
                    totalSites: 224,
                    completedSites: 34
                }
            }
        ];

        return new Response(JSON.stringify({
            success: true,
            projects: projects,
            total: projects.length
        }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('Error in GET /api/v1/projects:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export async function onRequestPost(context) {
    try {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        };

        // 解析請求資料
        const data = await context.request.json();
        console.log('Creating project with data:', data);

        // 驗證必要欄位
        if (!data.name || !data.opportunityId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields: name and opportunityId'
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // 創建專案物件
        const project = {
            id: data.opportunityId,
            name: data.name,
            opportunity_id: data.opportunityId,
            company: data.permissions?.owners?.[0]?.company || '勝興建設股份有限公司',
            engineeringTypes: [],
            status: 'active',
            progress: 0,
            unit_count: 224,
            completed_count: 0,
            lastUpdate: new Date().toLocaleDateString('zh-TW'),
            created_at: new Date().toISOString(),
            permissions: data.permissions || {},
            stats: data.stats || { totalSites: 224, completedSites: 0 }
        };

        // 根據選擇的工程類型設定
        if (data.spcEngineering && Object.keys(data.spcEngineering).length > 0) {
            project.engineeringTypes.push('SPC');
        }
        if (data.cabinetEngineering && Object.keys(data.cabinetEngineering).length > 0) {
            project.engineeringTypes.push('CABINET');
        }

        // 在實際環境中，這裡會儲存到 KV 或 D1 資料庫
        // 現在只是回傳成功回應
        console.log('Project created successfully:', project);

        return new Response(JSON.stringify({
            success: true,
            data: project,
            message: 'Project created successfully'
        }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('Error in POST /api/v1/projects:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export async function onRequestOptions(context) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}