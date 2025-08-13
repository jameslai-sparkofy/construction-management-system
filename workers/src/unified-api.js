/**
 * 工程管理系統 - 統一 API Worker
 * 版本: 3.0.0
 * 日期: 2025-08-12
 * 
 * 功能:
 * - 簡單認證系統（手機+密碼）
 * - 專案管理 CRUD
 * - D1 資料庫整合
 * - CRM 資料同步
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 標頭
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // 處理 OPTIONS 請求
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ===== 健康檢查 =====
      if (path === '/health' || path === '/') {
        return jsonResponse({
          name: '工程管理系統 API',
          status: 'healthy',
          version: '3.0.0',
          timestamp: new Date().toISOString(),
          endpoints: {
            auth: ['/api/v1/auth/login', '/api/v1/auth/verify'],
            projects: ['/api/v1/projects', '/api/v1/projects/:id'],
            sites: ['/api/v1/sites', '/api/v1/opportunities']
          }
        }, corsHeaders);
      }

      // ===== 認證系統 =====
      
      // 登入
      if (path === '/api/v1/auth/login' && method === 'POST') {
        const body = await request.json();
        const { phone, password } = body;

        if (!phone || !password) {
          return jsonResponse({
            success: false,
            error: '請提供手機號碼和密碼'
          }, corsHeaders, 400);
        }

        // 簡單驗證：密碼為手機號碼後3碼
        const expectedPassword = phone.slice(-3);
        if (password === expectedPassword) {
          // 生成 token
          const token = `token-${phone}-${Date.now()}`;
          
          // 儲存到 KV (如果有設定)
          if (env.SESSIONS) {
            await env.SESSIONS.put(token, JSON.stringify({
              phone,
              userId: phone,
              createdAt: new Date().toISOString()
            }), { expirationTtl: 86400 * 7 }); // 7天過期
          }

          return jsonResponse({
            success: true,
            data: {
              user: {
                id: phone,
                phone: phone,
                name: `用戶 ${phone.slice(-4)}`
              },
              token: token
            }
          }, corsHeaders);
        }

        return jsonResponse({
          success: false,
          error: '手機號碼或密碼錯誤'
        }, corsHeaders, 401);
      }

      // 驗證 Token
      if (path === '/api/v1/auth/verify' && method === 'GET') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }
        return jsonResponse({
          success: true,
          user: auth.user
        }, corsHeaders);
      }

      // ===== 專案管理 =====
      
      // 取得專案列表
      if (path === '/api/v1/projects' && method === 'GET') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        try {
          // 從 D1 取得專案
          const { results } = await env.DB_ENGINEERING.prepare(`
            SELECT 
              p.*,
              COUNT(DISTINCT ps.site_id) as site_count,
              COUNT(DISTINCT pf.file_id) as file_count
            FROM projects p
            LEFT JOIN project_sites ps ON p.id = ps.project_id
            LEFT JOIN project_files pf ON p.id = pf.project_id
            WHERE p.is_active = 1
            GROUP BY p.id
            ORDER BY p.created_at DESC
          `).all();

          return jsonResponse({
            success: true,
            projects: results || []
          }, corsHeaders);
        } catch (error) {
          console.error('Database error:', error);
          
          // 如果資料庫失敗，返回示範資料
          return jsonResponse({
            success: true,
            projects: [
              {
                id: 'proj_2025081201',
                name: '建功段建案',
                opportunity_id: 'opp_001',
                opportunity_name: '建功段',
                status: 'planning',
                progress: 25,
                created_at: '2025-08-01T00:00:00Z',
                site_count: 3,
                file_count: 5
              },
              {
                id: 'proj_2025081202',
                name: '興安西建案',
                opportunity_id: 'opp_002',
                opportunity_name: '興安西',
                status: 'in_progress',
                progress: 60,
                created_at: '2025-07-15T00:00:00Z',
                site_count: 2,
                file_count: 12
              }
            ],
            source: 'demo'
          }, corsHeaders);
        }
      }

      // 創建專案
      if (path === '/api/v1/projects' && method === 'POST') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        const data = await request.json();
        
        // 驗證必要欄位
        if (!data.name || !data.opportunity_id) {
          return jsonResponse({
            success: false,
            error: '缺少必要欄位: name, opportunity_id'
          }, corsHeaders, 400);
        }

        try {
          // 生成專案 ID
          const timestamp = Date.now();
          const projectId = data.id || `proj_${timestamp}`;

          // 插入專案到 D1
          await env.DB_ENGINEERING.prepare(`
            INSERT INTO projects (
              id, name, opportunity_id, opportunity_name,
              status, progress, created_by, created_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            projectId,
            data.name,
            data.opportunity_id,
            data.opportunity_name || data.name,
            data.status || 'planning',
            data.progress || 0,
            auth.user.id,
            new Date().toISOString(),
            1
          ).run();

          // 如果有建物資料，插入關聯
          if (data.sites && Array.isArray(data.sites)) {
            for (const site of data.sites) {
              await env.DB_ENGINEERING.prepare(`
                INSERT INTO project_sites (project_id, site_id, site_name)
                VALUES (?, ?, ?)
              `).bind(projectId, site.id, site.name).run();
            }
          }

          return jsonResponse({
            success: true,
            project: {
              id: projectId,
              name: data.name,
              opportunity_id: data.opportunity_id,
              status: data.status || 'planning',
              created_at: new Date().toISOString()
            }
          }, corsHeaders);
        } catch (error) {
          console.error('Create project error:', error);
          return jsonResponse({
            success: false,
            error: '創建專案失敗',
            details: error.message
          }, corsHeaders, 500);
        }
      }

      // 取得單一專案
      if (path.match(/^\/api\/v1\/projects\/[\w-]+$/) && method === 'GET') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        const projectId = path.split('/').pop();

        try {
          const project = await env.DB_ENGINEERING.prepare(`
            SELECT * FROM projects WHERE id = ? AND is_active = 1
          `).bind(projectId).first();

          if (!project) {
            return jsonResponse({
              success: false,
              error: '專案不存在'
            }, corsHeaders, 404);
          }

          // 取得相關建物
          const sites = await env.DB_ENGINEERING.prepare(`
            SELECT * FROM project_sites WHERE project_id = ?
          `).bind(projectId).all();

          // 取得相關檔案
          const files = await env.DB_ENGINEERING.prepare(`
            SELECT * FROM project_files WHERE project_id = ?
          `).bind(projectId).all();

          return jsonResponse({
            success: true,
            project: {
              ...project,
              sites: sites.results || [],
              files: files.results || []
            }
          }, corsHeaders);
        } catch (error) {
          console.error('Get project error:', error);
          return jsonResponse({
            success: false,
            error: '取得專案失敗'
          }, corsHeaders, 500);
        }
      }

      // 更新專案
      if (path.match(/^\/api\/v1\/projects\/[\w-]+$/) && method === 'PUT') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        const projectId = path.split('/').pop();
        const data = await request.json();

        try {
          // 建立更新 SQL
          const updates = [];
          const values = [];
          
          if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
          }
          if (data.status !== undefined) {
            updates.push('status = ?');
            values.push(data.status);
          }
          if (data.progress !== undefined) {
            updates.push('progress = ?');
            values.push(data.progress);
          }
          
          if (updates.length === 0) {
            return jsonResponse({
              success: false,
              error: '沒有要更新的欄位'
            }, corsHeaders, 400);
          }

          updates.push('updated_at = ?');
          values.push(new Date().toISOString());
          values.push(projectId);

          await env.DB_ENGINEERING.prepare(`
            UPDATE projects 
            SET ${updates.join(', ')}
            WHERE id = ? AND is_active = 1
          `).bind(...values).run();

          return jsonResponse({
            success: true,
            message: '專案更新成功'
          }, corsHeaders);
        } catch (error) {
          console.error('Update project error:', error);
          return jsonResponse({
            success: false,
            error: '更新專案失敗'
          }, corsHeaders, 500);
        }
      }

      // 刪除專案（軟刪除）
      if (path.match(/^\/api\/v1\/projects\/[\w-]+$/) && method === 'DELETE') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        const projectId = path.split('/').pop();

        try {
          await env.DB_ENGINEERING.prepare(`
            UPDATE projects 
            SET is_active = 0, updated_at = ?
            WHERE id = ?
          `).bind(new Date().toISOString(), projectId).run();

          return jsonResponse({
            success: true,
            message: '專案已刪除'
          }, corsHeaders);
        } catch (error) {
          console.error('Delete project error:', error);
          return jsonResponse({
            success: false,
            error: '刪除專案失敗'
          }, corsHeaders, 500);
        }
      }

      // ===== 商機/建物管理 =====
      
      // 取得商機列表（從 CRM）
      if (path === '/api/v1/opportunities' && method === 'GET') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        try {
          // 從 CRM 資料庫取得商機
          const { results } = await env.DB_CRM.prepare(`
            SELECT * FROM opportunities 
            WHERE is_active = 1
            ORDER BY created_at DESC
          `).all();

          return jsonResponse({
            success: true,
            opportunities: results || []
          }, corsHeaders);
        } catch (error) {
          console.error('Get opportunities error:', error);
          
          // 返回示範資料
          return jsonResponse({
            success: true,
            opportunities: [
              {
                id: 'opp_001',
                name: '建功段',
                address: '新竹市東區建功一路',
                status: 'active'
              },
              {
                id: 'opp_002',
                name: '興安西',
                address: '新竹市北區興安西路',
                status: 'active'
              }
            ],
            source: 'demo'
          }, corsHeaders);
        }
      }

      // 取得建物列表
      if (path === '/api/v1/sites' && method === 'GET') {
        const auth = await verifyAuth(request, env);
        if (!auth.success) {
          return jsonResponse(auth, corsHeaders, 401);
        }

        const opportunityId = url.searchParams.get('opportunity_id');
        
        try {
          let query = `SELECT * FROM sites WHERE is_active = 1`;
          const params = [];
          
          if (opportunityId) {
            query += ` AND opportunity_id = ?`;
            params.push(opportunityId);
          }
          
          query += ` ORDER BY building, floor, unit`;

          const stmt = params.length > 0 
            ? env.DB_CRM.prepare(query).bind(...params)
            : env.DB_CRM.prepare(query);
            
          const { results } = await stmt.all();

          return jsonResponse({
            success: true,
            sites: results || []
          }, corsHeaders);
        } catch (error) {
          console.error('Get sites error:', error);
          
          // 返回示範資料
          return jsonResponse({
            success: true,
            sites: [
              {
                id: 'site_001',
                opportunity_id: 'opp_001',
                building: 'A',
                floor: '1',
                unit: '101',
                type: '住宅'
              },
              {
                id: 'site_002',
                opportunity_id: 'opp_001',
                building: 'A',
                floor: '1',
                unit: '102',
                type: '住宅'
              }
            ],
            source: 'demo'
          }, corsHeaders);
        }
      }

      // 404 - 未找到端點
      return jsonResponse({
        error: 'Not found',
        path: path,
        method: method
      }, corsHeaders, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        error: 'Internal server error',
        message: error.message
      }, corsHeaders, 500);
    }
  }
};

// ===== 輔助函數 =====

/**
 * 驗證認證
 */
async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: '未提供認證 token'
    };
  }

  const token = authHeader.substring(7);
  
  // 允許測試 token
  if (token.startsWith('test-token-') || token === 'demo-token') {
    return {
      success: true,
      user: {
        id: 'test-user',
        name: '測試用戶'
      }
    };
  }

  // 檢查 KV 中的 session
  if (env.SESSIONS) {
    try {
      const session = await env.SESSIONS.get(token);
      if (session) {
        const data = JSON.parse(session);
        return {
          success: true,
          user: {
            id: data.userId,
            phone: data.phone
          }
        };
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  }

  // 簡單 token 驗證（格式: token-phone-timestamp）
  if (token.startsWith('token-')) {
    const parts = token.split('-');
    if (parts.length === 3) {
      return {
        success: true,
        user: {
          id: parts[1],
          phone: parts[1]
        }
      };
    }
  }

  return {
    success: false,
    error: '無效的 token'
  };
}

/**
 * 生成 JSON 回應
 */
function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}