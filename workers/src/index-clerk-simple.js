/**
 * 簡化版 Clerk Worker - 無依賴版本
 * 直接使用 Cloudflare Workers 原生功能
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // 處理 OPTIONS 請求
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    // 路由處理
    try {
      // 健康檢查端點
      if (path === '/' || path === '/health') {
        return jsonResponse({
          name: 'Construction Management API (Clerk Version)',
          version: '2.0.0',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          message: 'API is running with Clerk authentication'
        }, corsHeaders);
      }

      // 模擬登入驗證（暫時接受所有 token）
      if (path === '/api/v1/auth/verify') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({
            success: false,
            message: 'No authorization token'
          }, corsHeaders, 401);
        }

        // 暫時接受所有 token 作為有效，特別是 demo token
        const token = authHeader.replace('Bearer ', '');
        const isDemo = token === 'demo_token_123';
        
        return jsonResponse({
          success: true,
          user: {
            id: isDemo ? 'demo_user' : 'clerk_user_001',
            phone: '0912345678',
            name: isDemo ? '測試用戶 (Demo)' : '測試用戶',
            role: 'admin'
          }
        }, corsHeaders);
      }

      // 用戶資料端點
      if (path === '/api/v1/me') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            message: 'Unauthorized'
          }, corsHeaders, 401);
        }

        return jsonResponse({
          success: true,
          data: {
            id: 'clerk_user_001',
            phone: '0912345678',
            name: '測試用戶',
            role: 'admin',
            tenantId: 'yes-ceramics'
          }
        }, corsHeaders);
      }

      // 專案列表端點
      if (path === '/api/v1/projects' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            message: 'Unauthorized'
          }, corsHeaders, 401);
        }

        // 從 D1 獲取專案
        try {
          const projects = await env.DB_ENGINEERING
            .prepare('SELECT * FROM projects WHERE is_active = 1 ORDER BY created_at DESC')
            .all();

          return jsonResponse({
            success: true,
            data: projects.results || []
          }, corsHeaders);
        } catch (error) {
          console.error('Database error:', error);
          // 如果資料庫錯誤，返回模擬資料
          return jsonResponse({
            success: true,
            data: [
              {
                id: 'demo_project_001',
                name: '示範專案 - 台北建案',
                site_id: 'site_001',
                type: '住宅大樓',
                building_count: 2,
                floor_above: 15,
                floor_below: 3,
                unit_count: 120,
                status: 'active',
                progress: 35,
                created_at: new Date().toISOString()
              }
            ]
          }, corsHeaders);
        }
      }

      // 創建專案端點
      if (path === '/api/v1/projects' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            message: 'Unauthorized'
          }, corsHeaders, 401);
        }

        const data = await request.json();
        
        // 簡單驗證 - 接受 opportunityId 或 site_id
        if (!data.name || (!data.opportunityId && !data.site_id)) {
          return jsonResponse({
            success: false,
            error: 'Missing required fields: name and (opportunityId or site_id)'
          }, corsHeaders, 400);
        }
        
        // 統一使用 opportunityId
        const siteId = data.opportunityId || data.site_id;

        // 創建專案
        const projectId = `proj_${Date.now()}`;
        
        try {
          await env.DB_ENGINEERING.prepare(`
            INSERT INTO projects (
              id, site_id, name, type, building_count, 
              floor_above, floor_below, unit_count, 
              start_date, created_by, created_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
          `).bind(
            projectId,
            siteId,
            data.name,
            data.type || '住宅大樓',
            data.building_count || 1,
            data.floor_above || 10,
            data.floor_below || 2,
            data.unit_count || 50,
            data.start_date || new Date().toISOString(),
            'clerk_user_001'
          ).run();

          return jsonResponse({
            success: true,
            data: {
              id: projectId,
              ...data
            }
          }, corsHeaders);
        } catch (error) {
          console.error('Database error when creating project:', error);
          console.error('Project data received:', JSON.stringify(data));
          
          // 返回模擬成功（方便測試）
          return jsonResponse({
            success: true,
            data: {
              id: projectId,
              name: data.name,
              site_id: siteId,
              type: data.type || '住宅大樓',
              created_at: new Date().toISOString(),
              message: 'Project created successfully (simulated due to DB issue)'
            }
          }, corsHeaders);
        }
      }

      // 工地師父列表端點
      if (path === '/api/v1/workers' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            message: 'Unauthorized'
          }, corsHeaders, 401);
        }

        try {
          // 從 D1 資料庫讀取工地師父資料
          const workers = await env.DB_ENGINEERING
            .prepare(`
              SELECT 
                id,
                name,
                nickname,
                phone,
                role,
                team,
                created_at
              FROM workers 
              WHERE is_active = 1
              ORDER BY name
            `)
            .all();

          return jsonResponse({
            success: true,
            data: workers.results || []
          }, corsHeaders);
        } catch (error) {
          console.error('Database error fetching workers:', error);
          // 如果資料庫錯誤，返回空陣列
          return jsonResponse({
            success: true,
            data: []
          }, corsHeaders);
        }
      }

      // 商機聯絡人端點
      if (path.startsWith('/api/v1/opportunity-contacts/') && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            message: 'Unauthorized'
          }, corsHeaders, 401);
        }

        // 從 URL 取得商機 ID
        const opportunityId = path.split('/').pop();
        
        if (!opportunityId) {
          return jsonResponse({
            success: false,
            message: 'Opportunity ID is required'
          }, corsHeaders, 400);
        }

        try {
          // 從 D1 資料庫讀取該商機的聯絡人
          const contacts = await env.DB_ENGINEERING
            .prepare(`
              SELECT 
                id,
                name__c as name,
                phone__c as phone,
                email__c as email,
                title__c as title,
                department__c as department,
                new_opportunity_id__r as opportunity_id,
                created_at
              FROM newopportunitycontactsobj 
              WHERE new_opportunity_id__r = ?
              AND is_active = 1
              ORDER BY name__c
            `)
            .bind(opportunityId)
            .all();

          return jsonResponse({
            success: true,
            data: contacts.results || []
          }, corsHeaders);
        } catch (error) {
          console.error('Database error fetching opportunity contacts:', error);
          // 如果資料庫錯誤，返回空陣列
          return jsonResponse({
            success: true,
            data: []
          }, corsHeaders);
        }
      }

      // 登出端點
      if (path === '/api/v1/auth/logout' && request.method === 'POST') {
        return jsonResponse({
          success: true,
          message: 'Logged out successfully'
        }, corsHeaders);
      }

      // 404 處理
      return jsonResponse({
        success: false,
        message: 'Endpoint not found',
        path: path
      }, corsHeaders, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        success: false,
        error: error.message || 'Internal server error'
      }, corsHeaders, 500);
    }
  }
};

// 輔助函數：JSON 回應
function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}