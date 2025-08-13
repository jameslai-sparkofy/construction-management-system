addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env, event.waitUntil))
})

async function handleRequest(request, env, waitUntil) {
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

  try {
    console.log('Request path:', path);
    console.log('Request method:', request.method);
    
    // 健康檢查端點
    if (path === '/' || path === '/health') {
      return jsonResponse({
        name: 'Construction Management API (Test Version)',
        version: '2.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        path: path
      }, corsHeaders);
    }

    // 測試端點 - 不需要認證
    if (path === '/api/v1/test' && request.method === 'GET') {
      return jsonResponse({
        success: true,
        message: 'Worker API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.1'
      }, corsHeaders);
    }

    // 創建專案端點 - 改進版
    if (path === '/api/v1/projects' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      console.log('Auth header:', authHeader);
      
      // 簡單驗證 - 只要有Bearer token就接受
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({
          success: false,
          message: 'Unauthorized',
          error: 'Missing Authorization header'
        }, corsHeaders, 401);
      }

      const token = authHeader.replace('Bearer ', '').trim();
      console.log('Token received:', token);
      
      if (token.length < 5) {
        return jsonResponse({
          success: false,
          message: 'Unauthorized',
          error: 'Invalid token format'
        }, corsHeaders, 401);
      }

      // 解析請求數據
      let data;
      try {
        data = await request.json();
        console.log('Request data:', JSON.stringify(data, null, 2));
      } catch (error) {
        return jsonResponse({
          success: false,
          error: 'Invalid JSON in request body'
        }, corsHeaders, 400);
      }
      
      // 驗證必要欄位
      if (!data.name || !data.opportunityId) {
        return jsonResponse({
          success: false,
          error: 'Missing required fields: name and opportunityId',
          receivedData: data
        }, corsHeaders, 400);
      }

      // 嘗試寫入 D1 資料庫
      try {
        // 檢查 DB_ENGINEERING 是否可用
        if (env && env.DB_ENGINEERING) {
          const projectData = {
            id: data.opportunityId, // 使用商機ID作為專案ID
            opportunity_id: data.opportunityId,
            name: data.name,
            spc_engineering: JSON.stringify(data.spcEngineering || {}),
            cabinet_engineering: JSON.stringify(data.cabinetEngineering || {}),
            permissions: JSON.stringify(data.permissions || {}),
            cached_stats: JSON.stringify(data.stats || {}),
            status: 'active',
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // 執行插入或更新
          const result = await env.DB_ENGINEERING.prepare(`
            INSERT INTO projects (
              id, opportunity_id, name, spc_engineering, cabinet_engineering,
              permissions, cached_stats, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              spc_engineering = excluded.spc_engineering,
              cabinet_engineering = excluded.cabinet_engineering,
              permissions = excluded.permissions,
              cached_stats = excluded.cached_stats,
              updated_at = excluded.updated_at
          `).bind(
            projectData.id,
            projectData.opportunity_id,
            projectData.name,
            projectData.spc_engineering,
            projectData.cabinet_engineering,
            projectData.permissions,
            projectData.cached_stats,
            projectData.status,
            projectData.created_by,
            projectData.created_at,
            projectData.updated_at
          ).run();

          console.log('Database insert result:', result);

          return jsonResponse({
            success: true,
            data: {
              id: data.opportunityId,
              name: data.name,
              opportunity_id: data.opportunityId,
              created_at: projectData.created_at,
              permissions: data.permissions || {},
              stats: data.stats || {}
            },
            message: 'Project created successfully'
          }, corsHeaders);

        } else {
          // 沒有資料庫連接，使用模擬模式
          console.log('No database connection, using simulation mode');
          
          return jsonResponse({
            success: true,
            data: {
              id: data.opportunityId,
              name: data.name,
              opportunity_id: data.opportunityId,
              created_at: new Date().toISOString(),
              permissions: data.permissions || {},
              stats: data.stats || {}
            },
            message: 'Project created successfully (simulation mode)'
          }, corsHeaders);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // 即使資料庫出錯，也回傳成功（允許前端繼續）
        return jsonResponse({
          success: true,
          data: {
            id: data.opportunityId,
            name: data.name,
            opportunity_id: data.opportunityId,
            created_at: new Date().toISOString(),
            permissions: data.permissions || {},
            stats: data.stats || {}
          },
          message: 'Project created successfully (database unavailable)',
          warning: 'Database operation failed, but project data accepted'
        }, corsHeaders);
      }
    }

    // 獲取專案列表端點
    if (path === '/api/v1/projects' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      // 簡單驗證
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({
          success: false,
          message: 'Unauthorized',
          error: 'Missing Authorization header'
        }, corsHeaders, 401);
      }

      try {
        // 檢查是否有資料庫連接
        if (env && env.DB_ENGINEERING) {
          // 從資料庫讀取專案
          const result = await env.DB_ENGINEERING.prepare(`
            SELECT id, opportunity_id, name, status, cached_stats, created_at, updated_at
            FROM projects
            ORDER BY created_at DESC
            LIMIT 100
          `).all();

          const projects = result.results.map(project => ({
            id: project.id,
            name: project.name,
            opportunity_id: project.opportunity_id,
            status: project.status || 'active',
            stats: project.cached_stats ? JSON.parse(project.cached_stats) : {},
            created_at: project.created_at,
            updated_at: project.updated_at,
            // 為了相容性，添加一些預設值
            company: '勝興建設股份有限公司',
            engineeringTypes: ['SPC', 'CABINET'],
            progress: 0,
            unit_count: 224,
            completed_count: 0,
            lastUpdate: new Date(project.updated_at).toLocaleDateString('zh-TW')
          }));

          return jsonResponse({
            success: true,
            projects: projects,
            total: projects.length
          }, corsHeaders);

        } else {
          // 沒有資料庫，返回空列表
          return jsonResponse({
            success: true,
            projects: [],
            total: 0,
            message: 'Database not available'
          }, corsHeaders);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        // 返回空列表而不是錯誤
        return jsonResponse({
          success: true,
          projects: [],
          total: 0,
          warning: 'Failed to fetch projects from database'
        }, corsHeaders);
      }
    }

    // 404 處理
    return jsonResponse({
      success: false,
      message: 'Endpoint not found',
      path: path,
      method: request.method
    }, corsHeaders, 404);

  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse({
      success: false,
      error: error.message || 'Internal server error',
      stack: error.stack
    }, corsHeaders, 500);
  }
}

// 輔助函數：JSON 回應
function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}