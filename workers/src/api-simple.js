/**
 * 工程管理系統 API - Simplified Version
 * 使用單一 project_users 表的簡化設計
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
        name: '工程管理系統 API (Simplified)',
        status: 'healthy',
        version: '1.0.0-simple',
        timestamp: new Date().toISOString()
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
    
    // Get current user
    if (path === '/api/v1/users/me' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        user: { id: 'admin', name: '系統管理員', role: 'admin' }
      }), { headers });
    }
    
    // Get projects
    if (path === '/api/v1/projects' && method === 'GET') {
      try {
        const query = env.DB_ENGINEERING.prepare(`
          SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC
        `);
        
        const { results } = await query.all();
        
        const projects = results.map(proj => {
          const spcEng = proj.spc_engineering ? JSON.parse(proj.spc_engineering) : {};
          const cabinetEng = proj.cabinet_engineering ? JSON.parse(proj.cabinet_engineering) : {};
          const engineeringTypes = [];
          if (spcEng.enabled) engineeringTypes.push('SPC');
          if (cabinetEng.enabled) engineeringTypes.push('浴櫃');
          
          return {
            id: proj.id,
            name: proj.name,
            opportunity_id: proj.opportunity_id,
            status: proj.status,
            progress: 0,
            engineeringTypes: engineeringTypes,
            created_at: proj.created_at,
            updated_at: proj.updated_at
          };
        });
        
        return new Response(JSON.stringify({
          success: true,
          projects: projects,
          total: projects.length
        }), { headers });
        
      } catch (error) {
        console.error('Error fetching projects:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch projects',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get project by ID
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+$/) && method === 'GET') {
      try {
        const projectId = path.split('/').pop();
        
        const project = await env.DB_ENGINEERING.prepare(`
          SELECT * FROM projects WHERE id = ? AND status = 'active'
        `).bind(projectId).first();
        
        if (!project) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project not found'
          }), { status: 404, headers });
        }
        
        const spcEng = project.spc_engineering ? JSON.parse(project.spc_engineering) : {};
        const cabinetEng = project.cabinet_engineering ? JSON.parse(project.cabinet_engineering) : {};
        const permissions = project.permissions ? JSON.parse(project.permissions) : {};
        
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
        
        return new Response(JSON.stringify({
          ...projectData,
          success: true,
          project: projectData
        }), { headers });
        
      } catch (error) {
        console.error('Error fetching project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch project',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Add user to project - 使用簡化的單表結構
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/add$/) && method === 'POST') {
      try {
        const projectId = path.split('/')[4];
        const body = await request.json();
        
        const {
          user_id,
          user_type,
          user_role,
          team_id,
          team_name,
          source_table,
          phone,
          name,
          nickname
        } = body;
        
        console.log('[DEBUG] Adding user to project:', { projectId, body });
        
        // Check if user already exists in project
        const existing = await env.DB_ENGINEERING.prepare(`
          SELECT id FROM project_users 
          WHERE project_id = ? AND user_id = ?
        `).bind(projectId, user_id).first();
        
        if (existing) {
          return new Response(JSON.stringify({
            success: false,
            error: '該用戶已在專案中'
          }), { status: 400, headers });
        }
        
        // Insert new project user
        await env.DB_ENGINEERING.prepare(`
          INSERT INTO project_users (
            project_id, user_id, user_type, team_id, team_name,
            name, phone, nickname, source_table, added_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          projectId,
          user_id,
          user_type || 'worker',
          team_id || null,
          team_name || null,
          name,
          phone || null,
          nickname || null,
          source_table || 'manual',
          'system'
        ).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '用戶已成功添加到專案',
          data: {
            project_id: projectId,
            user_id: user_id,
            user_type,
            team_id
          }
        }), { headers });
        
      } catch (error) {
        console.error('Error adding user to project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to add user',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get project users - 返回前端期望的格式
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting users for project:', projectId);
        
        // Get all users for this project
        const { results } = await env.DB_ENGINEERING.prepare(`
          SELECT * FROM project_users 
          WHERE project_id = ?
          ORDER BY user_type, team_name, name
        `).bind(projectId).all();
        
        // Group users by type
        const admins = [];
        const owners = [];
        const teams = new Map();
        
        for (const user of results || []) {
          const userObj = {
            user_id: user.user_id,
            name: user.name,
            phone: user.phone,
            nickname: user.nickname
          };
          
          if (user.user_type === 'admin') {
            admins.push(userObj);
          } else if (user.user_type === 'owner') {
            owners.push(userObj);
          } else if (user.user_type === 'worker' && user.team_id) {
            if (!teams.has(user.team_id)) {
              teams.set(user.team_id, {
                team_id: user.team_id,
                team_name: user.team_name || user.team_id,
                members: []
              });
            }
            teams.get(user.team_id).members.push(userObj);
          }
        }
        
        // Return in the format frontend expects
        return new Response(JSON.stringify({
          success: true,
          data: {
            all: results || [],
            grouped: {
              admins: admins,
              owners: owners,
              teams: Array.from(teams.values())
            }
          }
        }), { headers });
        
      } catch (error) {
        console.error('Error fetching project users:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch users',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Delete user from project
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/([^\/]+)$/) && method === 'DELETE') {
      try {
        const projectId = path.split('/')[4];
        const userId = path.split('/')[6];
        
        console.log('[DEBUG] Removing user from project:', { projectId, userId });
        
        const result = await env.DB_ENGINEERING.prepare(`
          DELETE FROM project_users 
          WHERE project_id = ? AND user_id = ?
        `).bind(projectId, userId).run();
        
        if (result.meta.changes > 0) {
          return new Response(JSON.stringify({
            success: true,
            message: '用戶已從專案中移除'
          }), { headers });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: '找不到該用戶'
        }), { status: 404, headers });
        
      } catch (error) {
        console.error('Error removing user:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to remove user',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get teams from CRM
    if (path === '/api/v1/teams' && method === 'GET') {
      try {
        const projectId = url.searchParams.get('project_id');
        
        if (projectId) {
          // Return mock teams for testing
          const projectTeams = [
            { id: '66a21ce3f0032b000142088f', name: '周華龍工班' },
            { id: '66a3651be4a03100013b9a6f', name: '樂邁(工班)-愛德美特有限公司' },
            { id: '66bbed4c1ca88f0001c83bc9', name: '莊聰源師傅/菲米裝潢工程行' }
          ];
          
          return new Response(JSON.stringify({
            success: true,
            data: projectTeams
          }), { headers });
        } else {
          // Get all teams from CRM
          const query = env.DB_CRM.prepare(`
            SELECT DISTINCT
              _id as id,
              name,
              tel as phone
            FROM supplierobj
            WHERE is_deleted = 0
            AND life_status = 'normal'
            ORDER BY name
            LIMIT 50
          `);
          
          const { results } = await query.all();
          
          return new Response(JSON.stringify({
            success: true,
            data: results || []
          }), { headers });
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch teams',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get workers for a team from CRM
    if (path.match(/^\/api\/v1\/teams\/[^\/]+\/workers$/) && method === 'GET') {
      try {
        const teamId = path.split('/')[4];
        console.log('[DEBUG] Getting workers for team:', teamId);
        
        // Get team name from SupplierObj - 用於工班名稱匹配
        let teamName = null;
        try {
          const supplierQuery = env.DB_CRM.prepare(`
            SELECT name FROM SupplierObj WHERE _id = ?
          `);
          const supplier = await supplierQuery.bind(teamId).first();
          if (supplier) {
            teamName = supplier.name;
            console.log('[DEBUG] Found team name from SupplierObj:', teamName);
          }
        } catch (error) {
          console.error('Error querying SupplierObj:', error);
        }
        
        // 主要使用工班名稱進行查詢，因為 ID 可能不一致
        const searchTerm = teamName || teamId;
        
        // Query workers - 使用工班名稱進行匹配
        // field_D1087__c__r 是工班名稱（主要匹配欄位）
        // field_D1087__c 是工班 ID（備用）
        const query = env.DB_CRM.prepare(`
          SELECT 
            _id as id,
            name,
            phone_number__c,
            abbreviation__c,
            field_D1087__c as team_id_field,
            field_D1087__c__r as team_name
          FROM object_50hj8__c
          WHERE field_D1087__c__r LIKE ?
            AND is_deleted = 0
            AND life_status = 'normal'
          ORDER BY name
          LIMIT 50
        `);
        
        // 使用工班名稱進行查詢
        const { results } = await query.bind(`%${searchTerm}%`).all();
        console.log(`[DEBUG] Found ${results ? results.length : 0} workers for team: ${searchTerm}`);
        
        // 如果沒有查詢到結果，返回空陣列
        if (!results || results.length === 0) {
          console.log('[DEBUG] No workers found for team:', searchTerm);
          return new Response(JSON.stringify({
            success: true,
            data: [],
            total: 0,
            message: `未找到 ${teamName || teamId} 的工班成員`
          }), { headers });
        }
        
        const workers = results.map(worker => ({
          user_id: `crm_worker_${worker.id}`,
          name: worker.name || '未命名',
          phone: worker.phone_number__c || '',
          nickname: worker.abbreviation__c || (worker.name ? worker.name.slice(-1) : ''),
          team_id: teamId,
          source_type: 'crm_worker',
          source_id: worker.id
        }));
        
        return new Response(JSON.stringify({
          success: true,
          data: workers,
          total: workers.length
        }), { headers });
        
      } catch (error) {
        console.error('Error fetching team workers:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch workers',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get admins from CRM
    if (path === '/api/v1/admins' && method === 'GET') {
      try {
        const query = env.DB_CRM.prepare(`
          SELECT 
            _id as user_id,
            name,
            phone,
            email
          FROM employees_simple
          WHERE is_deleted = 0
          AND life_status = 'normal'
          ORDER BY name
          LIMIT 50
        `);
        
        const { results } = await query.all();
        
        const admins = (results || []).map(admin => ({
          ...admin,
          nickname: admin.name ? admin.name.slice(-1) : '',
          source_type: 'crm_admin',
          source_id: admin.user_id
        }));
        
        return new Response(JSON.stringify({
          success: true,
          data: admins
        }), { headers });
        
      } catch (error) {
        console.error('Error fetching admins:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch admins',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Default 404
    return new Response(JSON.stringify({
      success: false,
      error: 'Endpoint not found',
      path: path,
      method: method
    }), { status: 404, headers });
  }
};