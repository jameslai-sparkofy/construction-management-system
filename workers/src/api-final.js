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
    
    // Get single project by ID (but not stats or other special endpoints)
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+$/) && method === 'GET') {
      try {
        const projectId = path.split('/').pop();
        console.log('[DEBUG] api-final.js - Getting project by ID:', projectId);
        
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
            p.permissions,
            p.created_by
          FROM projects p
          WHERE p.id = ? AND p.status = 'active'
        `);
        
        const project = await query.bind(projectId).first();
        
        if (!project) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project not found',
            message: `專案 ${projectId} 不存在`
          }), { status: 404, headers });
        }
        
        // Parse JSON fields
        const spcEng = project.spc_engineering ? JSON.parse(project.spc_engineering) : {};
        const cabinetEng = project.cabinet_engineering ? JSON.parse(project.cabinet_engineering) : {};
        const permissions = project.permissions ? JSON.parse(project.permissions) : {};
        
        // Determine engineering types
        const engineeringTypes = [];
        if (spcEng.enabled) engineeringTypes.push('SPC');
        if (cabinetEng.enabled) engineeringTypes.push('浴櫃');
        
        const projectData = {
          id: project.id,
          name: project.name,
          opportunity_id: project.opportunity_id,
          status: 'active',
          progress: 0,
          engineeringTypes: engineeringTypes,
          created_at: project.created_at,
          updated_at: project.updated_at,
          spc_engineering: spcEng,
          cabinet_engineering: cabinetEng,
          permissions: permissions,
          created_by: project.created_by
        };
        
        console.log('[DEBUG] Found project:', projectData.name);
        
        return new Response(JSON.stringify({
          success: true,
          project: projectData
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] api-final.js - Error fetching project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch project',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Delete project by ID
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+$/) && method === 'DELETE') {
      try {
        const projectId = path.split('/').pop();
        console.log('[DEBUG] api-final.js - Deleting project by ID:', projectId);
        
        // First check if project exists
        const checkQuery = env.DB_ENGINEERING.prepare(`
          SELECT id FROM projects WHERE id = ? AND status = 'active'
        `);
        
        const project = await checkQuery.bind(projectId).first();
        
        if (!project) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project not found',
            message: `專案 ${projectId} 不存在`
          }), { status: 404, headers });
        }
        
        // Soft delete - mark as deleted instead of removing from database
        const deleteQuery = env.DB_ENGINEERING.prepare(`
          UPDATE projects 
          SET status = 'deleted', 
              updated_at = datetime('now')
          WHERE id = ?
        `);
        
        await deleteQuery.bind(projectId).run();
        
        console.log('[DEBUG] Project deleted successfully:', projectId);
        
        return new Response(JSON.stringify({
          success: true,
          message: '專案已成功刪除',
          deleted_id: projectId
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] api-final.js - Error deleting project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to delete project',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Update project by ID
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+$/) && (method === 'PUT' || method === 'PATCH')) {
      try {
        const projectId = path.split('/').pop();
        const data = await request.json();
        console.log('[DEBUG] api-final.js - Updating project:', projectId, data);
        
        // Check if project exists
        const checkQuery = env.DB_ENGINEERING.prepare(`
          SELECT id FROM projects WHERE id = ? AND status = 'active'
        `);
        
        const project = await checkQuery.bind(projectId).first();
        
        if (!project) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project not found',
            message: `專案 ${projectId} 不存在`
          }), { status: 404, headers });
        }
        
        // Build update query dynamically based on provided fields
        const updateFields = [];
        const values = [];
        
        if (data.name !== undefined) {
          updateFields.push('name = ?');
          values.push(data.name);
        }
        
        if (data.opportunity_id !== undefined) {
          updateFields.push('opportunity_id = ?');
          values.push(data.opportunity_id);
        }
        
        if (data.spc_engineering !== undefined) {
          updateFields.push('spc_engineering = ?');
          values.push(JSON.stringify(data.spc_engineering));
        }
        
        if (data.cabinet_engineering !== undefined) {
          updateFields.push('cabinet_engineering = ?');
          values.push(JSON.stringify(data.cabinet_engineering));
        }
        
        if (data.permissions !== undefined) {
          updateFields.push('permissions = ?');
          values.push(JSON.stringify(data.permissions));
        }
        
        if (data.project_status !== undefined) {
          updateFields.push('project_status = ?');
          values.push(data.project_status);
        }
        
        // Always update the updated_at timestamp
        updateFields.push('updated_at = datetime("now")');
        
        if (updateFields.length === 1) {
          // Only updated_at, nothing else to update
          return new Response(JSON.stringify({
            success: false,
            error: 'No fields to update',
            message: '沒有提供要更新的欄位'
          }), { status: 400, headers });
        }
        
        // Add projectId at the end for WHERE clause
        values.push(projectId);
        
        const updateQuery = env.DB_ENGINEERING.prepare(`
          UPDATE projects 
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `);
        
        await updateQuery.bind(...values).run();
        
        // Fetch updated project
        const fetchQuery = env.DB_ENGINEERING.prepare(`
          SELECT * FROM projects WHERE id = ?
        `);
        
        const updatedProject = await fetchQuery.bind(projectId).first();
        
        console.log('[DEBUG] Project updated successfully:', projectId);
        
        return new Response(JSON.stringify({
          success: true,
          message: '專案已成功更新',
          project: updatedProject
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] api-final.js - Error updating project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update project',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Project statistics
    if (path === '/api/v1/projects/stats' && method === 'GET') {
      try {
        const statsQuery = env.DB_ENGINEERING.prepare(`
          SELECT 
            COUNT(*) as total,
            0 as not_started,
            0 as in_progress,
            0 as maintenance,
            0 as warranty,
            0 as completed
          FROM projects
          WHERE status = 'active'
        `);
        
        const stats = await statsQuery.first();
        
        return new Response(JSON.stringify({
          success: true,
          stats: {
            total: stats.total || 0,
            by_status: {
              not_started: stats.not_started || 0,
              in_progress: stats.in_progress || 0,
              maintenance: stats.maintenance || 0,
              warranty: stats.warranty || 0,
              completed: stats.completed || 0
            }
          }
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error getting project stats:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get stats',
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