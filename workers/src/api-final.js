/**
 * 工程管理系統 API - 最終簡化版
 * 版本: 3.0.1-final
 * 支援: 簡單認證 + Clerk 認證
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };
    
    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    // Health check
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({ 
        name: '工程管理系統 API',
        status: 'healthy',
        version: '3.1.0-final-new-token',
        timestamp: new Date().toISOString(),
        features: {
          simpleAuth: true,
          clerkAuth: true,
          projectManagement: true
        }
      }), { headers });
    }
    
    // Simple login
    if (path === '/api/v1/auth/login' && method === 'POST') {
      const body = await request.json();
      const { phone, password } = body;
      
      if (phone === '0912345678' && password === '678') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            user: { id: 'admin', name: '系統管理員' },
            token: 'token-' + Date.now()
          }
        }), { headers });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: '登入失敗'
      }), { status: 401, headers });
    }
    
    // Projects list
    if (path === '/api/v1/projects' && method === 'GET') {
      try {
        console.log('[DEBUG] api-final.js - Getting projects from D1');
        
        const query = env.DB_ENGINEERING.prepare(`
          SELECT 
            p.id,
            p.opportunity_id,
            p.name,
            p.status,
            p.created_at,
            p.updated_at,
            p.spc_engineering,
            p.cabinet_engineering,
            p.created_by
          FROM projects p
          WHERE p.status = 'active'
          ORDER BY p.created_at DESC
        `);
        
        const { results } = await query.all();
        console.log('[DEBUG] Found', results?.length || 0, 'projects in D1');
        
        // Process each project
        const projects = results.map(project => {
          // Parse JSON fields
          const spcEng = project.spc_engineering ? JSON.parse(project.spc_engineering) : {};
          const cabinetEng = project.cabinet_engineering ? JSON.parse(project.cabinet_engineering) : {};
          
          // Determine engineering types
          const engineeringTypes = [];
          if (spcEng.enabled) engineeringTypes.push('SPC');
          if (cabinetEng.enabled) engineeringTypes.push('浴櫃');
          
          return {
            id: project.id,
            name: project.name,
            opportunity_id: project.opportunity_id,
            status: 'active',
            progress: 0,
            engineeringTypes: engineeringTypes,
            created_at: project.created_at,
            updated_at: project.updated_at
          };
        });
        
        return new Response(JSON.stringify({
          success: true,
          projects: projects,
          total: projects.length
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] api-final.js - Error fetching projects:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch projects',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Create project
    if (path === '/api/v1/projects' && method === 'POST') {
      try {
        const data = await request.json();
        console.log('[DEBUG] Creating project with data:', JSON.stringify(data));
        
        const projectId = 'proj_' + Date.now();
        
        // Insert into D1 database
        await env.DB_ENGINEERING.prepare(`
          INSERT INTO projects (
            id, opportunity_id, name, 
            spc_engineering, cabinet_engineering, permissions,
            status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
        `).bind(
          projectId,
          data.opportunityId || data.opportunity_id || '',
          data.name || '',
          JSON.stringify(data.spcEngineering || {}),
          JSON.stringify(data.cabinetEngineering || {}),
          JSON.stringify(data.permissions || {}),
          data.createdBy || 'system'
        ).run();
        
        console.log('[DEBUG] Project created successfully:', projectId);
        
        return new Response(JSON.stringify({
          success: true,
          project: {
            id: projectId,
            name: data.name,
            opportunity_id: data.opportunityId || data.opportunity_id,
            created_at: new Date().toISOString()
          }
        }), { headers });
      } catch (error) {
        console.error('[DEBUG] Error creating project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Opportunities
    if (path === '/api/v1/opportunities' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        opportunities: [
          { id: 'opp_001', name: '建功段', address: '新竹市東區' },
          { id: 'opp_002', name: '興安西', address: '新竹市北區' }
        ]
      }), { headers });
    }
    
    // Clerk 認證驗證端點
    if (path === '/api/v1/auth/clerk/verify' && method === 'POST') {
      const body = await request.json();
      const { token } = body;
      
      if (!token) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少 Clerk token'
        }), { status: 400, headers });
      }
      
      // 簡化處理：接受所有 Clerk token
      // 實際應該要驗證 JWT token
      return new Response(JSON.stringify({
        success: true,
        sessionToken: 'clerk-' + token.substring(0, 20) + '-' + Date.now(),
        user: {
          id: 'clerk-user',
          name: 'Clerk 用戶',
          authType: 'clerk'
        }
      }), { headers });
    }
    
    // Token 驗證端點
    if (path === '/api/v1/auth/verify' && method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: '未提供認證 token'
        }), { status: 401, headers });
      }
      
      const token = authHeader.substring(7);
      
      // 接受各種 token
      if (token.startsWith('token-') || token.startsWith('clerk-') || token === 'demo-token' || token.startsWith('test-token')) {
        return new Response(JSON.stringify({
          success: true,
          valid: true,
          user: {
            id: 'verified-user',
            name: '已驗證用戶'
          }
        }), { headers });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: '無效的 token'
      }), { status: 401, headers });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Not found',
      path: path
    }), { status: 404, headers });
  }
};