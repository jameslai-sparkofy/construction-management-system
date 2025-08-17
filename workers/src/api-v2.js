/**
 * 工程管理系統 API - Version 2.0
 * 使用新的資料表結構 (teams, members, team_memberships)
 */

// 模擬工班師父資料
function getMockWorkersForTeam(teamId) {
  const mockData = {
    '周華龍工班': [],
    '樂邁': [],
    '愛德美特': [
      { user_id: 'user_lai_junyinq', name: '賴俊穎', phone: '+886-963922033', nickname: '穎', email: '', team_id: teamId, shift_time__c: '愛德美特有限公司', shift_time__c__r: '愛德美特' }
    ],
    '莊聰源': []
  };
  
  for (const [teamName, workers] of Object.entries(mockData)) {
    if (teamId.includes(teamName) || teamName.includes(teamId)) {
      return workers;
    }
  }
  
  return [];
}

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
        name: '工程管理系統 API V2',
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        features: {
          simpleAuth: true,
          projectManagement: true,
          teamManagement: true,
          newSchema: true
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
          SELECT 
            p.id,
            p.opportunity_id,
            p.name,
            p.spc_engineering,
            p.cabinet_engineering,
            p.permissions,
            p.status,
            p.created_at,
            p.updated_at,
            p.created_by
          FROM projects p
          WHERE p.status = 'active'
          ORDER BY p.created_at DESC
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
            updated_at: proj.updated_at,
            created_by: proj.created_by
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
        
        const query = env.DB_ENGINEERING.prepare(`
          SELECT * FROM projects WHERE id = ? AND status = 'active'
        `);
        
        const project = await query.bind(projectId).first();
        
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
    
    // Add user to project - 使用新的表結構
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/add$/) && method === 'POST') {
      try {
        const projectId = path.split('/')[4];
        const body = await request.json();
        
        const {
          user_id,
          user_type,
          user_role,
          team_id,
          source_table,
          phone,
          name,
          nickname,
          password,
          email
        } = body;
        
        console.log('[DEBUG] Adding user to project:', { projectId, body });
        
        // Start transaction
        const statements = [];
        
        // 1. Check if member exists, if not create it
        let memberId = user_id;
        const existingMember = await env.DB_ENGINEERING.prepare(`
          SELECT user_id FROM members WHERE user_id = ? OR phone = ?
        `).bind(user_id, phone).first();
        
        if (!existingMember) {
          // Create new member
          statements.push(env.DB_ENGINEERING.prepare(`
            INSERT INTO members (
              user_id, name, phone, abbreviation, 
              source_type, source_id, password_suffix
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            user_id,
            name,
            phone,
            nickname || (name ? name.slice(-1) : ''),
            source_table || (user_type === 'owner' ? 'crm_admin' : 'crm_worker'),
            user_id,
            password ? password.slice(-3) : (phone ? phone.slice(-3) : '000')
          ));
        } else {
          memberId = existingMember.user_id;
        }
        
        // 2. Handle team-based users (workers)
        if (user_type === 'worker' && team_id) {
          // Ensure team exists
          const existingTeam = await env.DB_ENGINEERING.prepare(`
            SELECT id FROM teams WHERE id = ?
          `).bind(team_id).first();
          
          if (!existingTeam) {
            // Create team if not exists
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO teams (id, name) VALUES (?, ?)
            `).bind(team_id, team_id));
          }
          
          // Add member to team
          const membershipExists = await env.DB_ENGINEERING.prepare(`
            SELECT id FROM team_memberships WHERE team_id = ? AND member_id = ?
          `).bind(team_id, memberId).first();
          
          if (!membershipExists) {
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO team_memberships (team_id, member_id, role)
              VALUES (?, ?, ?)
            `).bind(team_id, memberId, user_role || 'team_member'));
          }
          
          // Add team to project
          const projectTeamExists = await env.DB_ENGINEERING.prepare(`
            SELECT id FROM project_teams WHERE project_id = ? AND team_id = ?
          `).bind(projectId, team_id).first();
          
          if (!projectTeamExists) {
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO project_teams (project_id, team_id)
              VALUES (?, ?)
            `).bind(projectId, team_id));
          }
        }
        
        // 3. Handle admins (owners)
        if (user_type === 'owner') {
          const adminExists = await env.DB_ENGINEERING.prepare(`
            SELECT id FROM project_admins WHERE project_id = ? AND admin_id = ?
          `).bind(projectId, memberId).first();
          
          if (!adminExists) {
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO project_admins (project_id, admin_id, role)
              VALUES (?, ?, ?)
            `).bind(projectId, memberId, 'admin'));
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: '該用戶已在專案中'
            }), { status: 400, headers });
          }
        }
        
        // Execute all statements
        if (statements.length > 0) {
          const results = await env.DB_ENGINEERING.batch(statements);
          console.log('[DEBUG] Batch insert results:', results);
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: '用戶已成功添加到專案',
          data: {
            project_id: projectId,
            user_id: memberId,
            user_type,
            team_id
          }
        }), { headers });
        
      } catch (error) {
        console.error('Error adding user to project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to add user',
          message: error.message,
          details: error.stack
        }), { status: 500, headers });
      }
    }
    
    // Get project users (teams and admins)
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting users for project:', projectId);
        
        // Get teams assigned to project
        const teamsQuery = await env.DB_ENGINEERING.prepare(`
          SELECT 
            t.id, t.name, t.site_count, t.member_count,
            tm.member_id, tm.role as member_role,
            m.name as member_name, m.phone as member_phone,
            m.abbreviation, m.source_type
          FROM project_teams pt
          JOIN teams t ON pt.team_id = t.id
          LEFT JOIN team_memberships tm ON t.id = tm.team_id
          LEFT JOIN members m ON tm.member_id = m.user_id
          WHERE pt.project_id = ?
          ORDER BY t.name, tm.role DESC, m.name
        `).bind(projectId).all();
        
        // Get admins assigned to project
        const adminsQuery = await env.DB_ENGINEERING.prepare(`
          SELECT 
            m.user_id, m.name, m.phone, m.abbreviation,
            m.source_type, pa.role
          FROM project_admins pa
          JOIN members m ON pa.admin_id = m.user_id
          WHERE pa.project_id = ?
          ORDER BY m.name
        `).bind(projectId).all();
        
        // Process teams and members
        const teamsMap = new Map();
        for (const row of teamsQuery.results || []) {
          if (!teamsMap.has(row.id)) {
            teamsMap.set(row.id, {
              id: row.id,
              name: row.name,
              site_count: row.site_count || 0,
              member_count: 0,
              members: []
            });
          }
          
          if (row.member_id) {
            const team = teamsMap.get(row.id);
            team.members.push({
              user_id: row.member_id,
              name: row.member_name,
              phone: row.member_phone,
              nickname: row.abbreviation,
              role: row.member_role,
              source_type: row.source_type
            });
            team.member_count = team.members.length;
          }
        }
        
        // Format admins
        const admins = (adminsQuery.results || []).map(admin => ({
          user_id: admin.user_id,
          name: admin.name,
          phone: admin.phone,
          nickname: admin.abbreviation,
          role: admin.role,
          source_type: admin.source_type,
          user_type: 'owner'
        }));
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            teams: Array.from(teamsMap.values()),
            admins: admins,
            workers: Array.from(teamsMap.values()).flatMap(t => 
              t.members.map(m => ({ ...m, team_id: t.id, team_name: t.name, user_type: 'worker' }))
            )
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
        
        // Check if it's an admin
        const adminDelete = await env.DB_ENGINEERING.prepare(`
          DELETE FROM project_admins 
          WHERE project_id = ? AND admin_id = ?
        `).bind(projectId, userId).run();
        
        if (adminDelete.meta.changes > 0) {
          return new Response(JSON.stringify({
            success: true,
            message: '管理員已從專案中移除'
          }), { headers });
        }
        
        // Check if it's a team member - need to find their team first
        const memberTeam = await env.DB_ENGINEERING.prepare(`
          SELECT tm.team_id 
          FROM team_memberships tm
          JOIN project_teams pt ON tm.team_id = pt.team_id
          WHERE pt.project_id = ? AND tm.member_id = ?
        `).bind(projectId, userId).first();
        
        if (memberTeam) {
          // Remove from team membership
          await env.DB_ENGINEERING.prepare(`
            DELETE FROM team_memberships 
            WHERE team_id = ? AND member_id = ?
          `).bind(memberTeam.team_id, userId).run();
          
          return new Response(JSON.stringify({
            success: true,
            message: '成員已從專案中移除'
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
          // Return teams for specific project
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
          // Return all teams from CRM
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
        
        // Get team name from SupplierObj
        let teamName = null;
        try {
          const supplierQuery = env.DB_CRM.prepare(`
            SELECT name, abbreviation__c
            FROM SupplierObj
            WHERE _id = ?
          `);
          const { results: supplierResults } = await supplierQuery.bind(teamId).all();
          
          if (supplierResults && supplierResults.length > 0) {
            teamName = supplierResults[0].name;
          }
        } catch (error) {
          console.error('Error querying SupplierObj:', error);
        }
        
        const searchTerm = teamName || teamId;
        
        // Query workers
        const query = env.DB_CRM.prepare(`
          SELECT 
            _id as id,
            name,
            shift_time__c,
            shift_time__c__r,
            phone_number__c,
            abbreviation__c
          FROM object_50hj8__c
          WHERE shift_time__c__r LIKE ? OR shift_time__c LIKE ?
          ORDER BY name
          LIMIT 50
        `);
        
        const { results } = await query.bind(`%${searchTerm}%`, `%${searchTerm}%`).all();
        
        if (!results || results.length === 0) {
          // Return mock data as fallback
          const mockWorkers = getMockWorkersForTeam(searchTerm);
          return new Response(JSON.stringify({
            success: true,
            data: mockWorkers,
            total: mockWorkers.length,
            mock: true
          }), { headers });
        }
        
        const workers = results.map(worker => ({
          user_id: `crm_worker_${worker.id}`,
          name: worker.name || '未命名',
          phone: worker.phone_number__c || '',
          nickname: worker.abbreviation__c || (worker.name ? worker.name.slice(-1) : ''),
          email: '',
          team_id: teamId,
          shift_time__c: worker.shift_time__c,
          shift_time__c__r: worker.shift_time__c__r,
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
        
        // Fallback to mock data
        const teamId = path.split('/')[4];
        const mockWorkers = getMockWorkersForTeam(teamId);
        
        return new Response(JSON.stringify({
          success: true,
          data: mockWorkers,
          total: mockWorkers.length,
          mock: true,
          error: error.message
        }), { headers });
      }
    }
    
    // Get admins from CRM
    if (path === '/api/v1/admins' && method === 'GET') {
      try {
        const query = env.DB_CRM.prepare(`
          SELECT 
            _id as user_id,
            name,
            phone as phone,
            '' as nickname,
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