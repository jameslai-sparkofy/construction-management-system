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
        user: { 
          id: 'admin', 
          name: '系統管理員', 
          role: 'admin',
          user_type: 'admin'  // 添加 user_type 字段
        }
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
        
        // Extract source_id from user_id if it's a CRM worker
        let sourceId = body.source_id;
        if (!sourceId && user_id.startsWith('crm_worker_')) {
          sourceId = user_id.replace('crm_worker_', '');
        }
        
        // Insert new project user with role and source_id
        await env.DB_ENGINEERING.prepare(`
          INSERT INTO project_users (
            project_id, user_id, user_type, team_id, team_name,
            name, phone, nickname, source_table, added_by, role, source_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          'system',
          body.role || 'member',
          sourceId || null
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
    
    // Get teams from project existing users (not from hardcoded query)
    if (path === '/api/v1/teams' && method === 'GET') {
      try {
        const projectId = url.searchParams.get('project_id');
        
        if (projectId) {
          // Get teams from existing project users
          const { results: projectTeams } = await env.DB_ENGINEERING.prepare(`
            SELECT DISTINCT team_id, team_name
            FROM project_users
            WHERE project_id = ? AND team_id IS NOT NULL AND team_name IS NOT NULL
            ORDER BY team_name
          `).bind(projectId).all();
          
          console.log('[DEBUG] Found project teams:', projectTeams);
          
          // If no teams found in project, return empty array
          if (!projectTeams || projectTeams.length === 0) {
            console.log('[DEBUG] No teams found in project, returning empty array');
            return new Response(JSON.stringify({
              success: true,
              data: []
            }), { headers });
          }
          
          // Format teams for frontend
          const teams = projectTeams.map(team => ({
            id: team.team_id,
            name: team.team_name
          }));
          
          return new Response(JSON.stringify({
            success: true,
            data: teams
          }), { headers });
        } else {
          // Get all teams from CRM (for general queries)
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
        
        // Try multiple strategies to find workers
        let results = [];
        
        // Strategy 1: Match by exact team name in field_D1087__c__r
        if (teamName) {
          const exactQuery = await env.DB_CRM.prepare(`
            SELECT 
              _id as id,
              name,
              phone_number__c,
              abbreviation__c,
              field_D1087__c as team_id_field,
              field_D1087__c__r as team_name
            FROM object_50hj8__c
            WHERE field_D1087__c__r = ?
              AND is_deleted = 0
              AND life_status = 'normal'
            ORDER BY name
            LIMIT 50
          `).bind(teamName).all();
          
          if (exactQuery.results && exactQuery.results.length > 0) {
            results = exactQuery.results;
            console.log(`[DEBUG] Found ${results.length} workers with exact match for: ${teamName}`);
          }
        }
        
        // Strategy 2: Partial match with team name
        if ((!results || results.length === 0) && teamName) {
          const partialQuery = await env.DB_CRM.prepare(`
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
          `).bind(`%${teamName}%`).all();
          
          if (partialQuery.results && partialQuery.results.length > 0) {
            results = partialQuery.results;
            console.log(`[DEBUG] Found ${results.length} workers with partial match for: ${teamName}`);
          }
        }
        
        // Strategy 3: Match by team ID in field_D1087__c
        if ((!results || results.length === 0)) {
          const idQuery = await env.DB_CRM.prepare(`
            SELECT 
              _id as id,
              name,
              phone_number__c,
              abbreviation__c,
              field_D1087__c as team_id_field,
              field_D1087__c__r as team_name
            FROM object_50hj8__c
            WHERE field_D1087__c = ?
              AND is_deleted = 0
              AND life_status = 'normal'
            ORDER BY name
            LIMIT 50
          `).bind(teamId).all();
          
          if (idQuery.results && idQuery.results.length > 0) {
            results = idQuery.results;
            console.log(`[DEBUG] Found ${results.length} workers with team ID: ${teamId}`);
          }
        }
        
        console.log(`[DEBUG] Total workers found: ${results ? results.length : 0}`);
        
        // 如果沒有查詢到結果，返回空陣列
        if (!results || results.length === 0) {
          console.log('[DEBUG] No workers found for team:', teamName || teamId);
          return new Response(JSON.stringify({
            success: true,
            data: [],
            total: 0,
            message: `未找到 ${teamName || teamId} 的工班成員`
          }), { headers });
        }
        
        // Filter out workers who are already in the project
        const projectId = url.searchParams.get('project_id');
        let filteredResults = results;
        
        if (projectId) {
          try {
            const { results: existingUsers } = await env.DB_ENGINEERING.prepare(`
              SELECT user_id FROM project_users 
              WHERE project_id = ? AND user_type = 'worker'
            `).bind(projectId).all();
            
            const existingUserIds = new Set(existingUsers.map(u => u.user_id));
            
            filteredResults = results.filter(worker => {
              const workerId = `crm_worker_${worker.id}`;
              return !existingUserIds.has(workerId);
            });
            
            console.log(`[DEBUG] Filtered out existing users. ${results.length} -> ${filteredResults.length} available`);
          } catch (filterError) {
            console.error('Error filtering existing users:', filterError);
            // If filtering fails, return all workers
          }
        }
        
        const workers = filteredResults.map(worker => ({
          user_id: `crm_worker_${worker.id}`,
          name: worker.name || '未命名',
          phone: worker.phone_number__c || '',
          nickname: worker.abbreviation__c || (worker.name ? worker.name.slice(-1) : ''),
          team_id: teamId,
          team_name: teamName || worker.team_name,
          source_type: 'crm_worker',
          source_id: worker.id,
          role: 'member'  // 預設為成員，可以後續修改為負責人
        }));
        
        return new Response(JSON.stringify({
          success: true,
          data: workers,
          total: workers.length,
          team_name: teamName
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
    
    // Get admins from CRM - support both endpoints
    if ((path === '/api/v1/admins' || path === '/api/v1/users/available/admins') && method === 'GET') {
      try {
        // Try different column names since the table structure might vary
        let results = [];
        
        try {
          // First try with _id (common in MongoDB-style schemas)
          const query1 = await env.DB_CRM.prepare(`
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
          `).all();
          results = query1.results;
        } catch (e1) {
          console.log('[DEBUG] Failed with _id, trying id column:', e1.message);
          try {
            // Try with id instead
            const query2 = await env.DB_CRM.prepare(`
              SELECT 
                id as user_id,
                name,
                phone,
                email
              FROM employees_simple
              WHERE is_deleted = 0
              AND life_status = 'normal'
              ORDER BY name
              LIMIT 50
            `).all();
            results = query2.results;
          } catch (e2) {
            console.log('[DEBUG] Failed with id too, trying without conditions:', e2.message);
            // Last resort - minimal query
            const query3 = await env.DB_CRM.prepare(`
              SELECT * FROM employees_simple LIMIT 10
            `).all();
            results = query3.results;
            console.log('[DEBUG] Got results from minimal query:', results.length);
          }
        }
        
        const admins = (results || []).map(admin => ({
          ...admin,
          user_id: admin.user_id || admin.id || admin._id || admin.open_user_id,
          phone: admin.phone || admin.mobile,
          nickname: admin.name ? admin.name.slice(-1) : '',
          source_type: 'crm_admin',
          source_id: admin.user_id || admin.id || admin._id || admin.open_user_id
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
    
    // Get owners - for now just return empty array  
    if (path === '/api/v1/users/available/owners' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        data: []
      }), { headers });
    }
    
    // Get workers - for now just return empty array
    if (path === '/api/v1/users/available/workers' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        data: []
      }), { headers });
    }
    
    // Get project teams (from sites and project_users)
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/teams$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting teams for project:', projectId);
        
        // First, get the project to get opportunity_id
        const project = await env.DB_ENGINEERING.prepare(`
          SELECT opportunity_id FROM projects WHERE id = ?
        `).bind(projectId).first();
        
        if (!project || !project.opportunity_id) {
          console.log('[DEBUG] No opportunity_id found for project');
          return new Response(JSON.stringify({
            success: true,
            teams: []
          }), { headers });
        }
        
        // Get teams from sites using CRM database
        const teamsMap = new Map();
        
        try {
          const { results: sites } = await env.DB_CRM.prepare(`
            SELECT DISTINCT shift_time__c as team_name
            FROM object_d1ae2__c
            WHERE opportunity__c = ?
              AND shift_time__c IS NOT NULL
              AND shift_time__c != '-'
              AND is_deleted = 0
              AND life_status = 'normal'
          `).bind(project.opportunity_id).all();
          
          console.log('[DEBUG] Found teams from sites:', sites);
          
          // Process teams from sites
          for (const site of sites || []) {
            if (site.team_name) {
              // Try to find team ID from SupplierObj
              let teamId = null;
              try {
                const supplier = await env.DB_CRM.prepare(`
                  SELECT _id FROM SupplierObj 
                  WHERE name = ? 
                    AND is_deleted = 0 
                    AND life_status = 'normal'
                  LIMIT 1
                `).bind(site.team_name).first();
                
                if (supplier) {
                  teamId = supplier._id;
                }
              } catch (err) {
                console.error('Error finding supplier:', err);
              }
              
              // If no ID found, generate one from team name
              if (!teamId) {
                teamId = 'team_' + site.team_name.replace(/[^\w]/g, '_');
              }
              
              teamsMap.set(teamId, {
                id: teamId,
                name: site.team_name,
                memberCount: 0,
                members: []
              });
            }
          }
        } catch (error) {
          console.error('Error fetching teams from sites:', error);
        }
        
        // Get existing members from project_users
        const { results: projectUsers } = await env.DB_ENGINEERING.prepare(`
          SELECT user_id, name, phone, nickname, user_type, team_id, team_name, role, source_id
          FROM project_users 
          WHERE project_id = ? AND team_id IS NOT NULL
          ORDER BY team_id, user_type, name
        `).bind(projectId).all();
        
        // Add members to teams (only process users with valid team_id)
        for (const user of projectUsers || []) {
          // Skip users without valid team_id
          if (!user.team_id || user.team_id.trim() === '') {
            console.log('[DEBUG] Skipping user without team_id:', user.name);
            continue;
          }
          
          if (!teamsMap.has(user.team_id)) {
            // If team not in sites, add it from project_users (with valid team data)
            if (user.team_name && user.team_name.trim() !== '') {
              teamsMap.set(user.team_id, {
                id: user.team_id,
                name: user.team_name,
                memberCount: 0,
                members: []
              });
            } else {
              console.log('[DEBUG] Skipping user with invalid team data:', user.name, user.team_id);
              continue;
            }
          }
          
          const team = teamsMap.get(user.team_id);
          team.members.push({
            userId: user.user_id,
            name: user.name,
            phone: user.phone,
            nickname: user.nickname,
            role: user.role || 'member',
            userType: user.user_type,
            sourceId: user.source_id
          });
          team.memberCount = team.members.length;
        }
        
        const teams = Array.from(teamsMap.values());
        console.log('[DEBUG] Final teams with members:', teams);
        
        return new Response(JSON.stringify({
          success: true,
          teams: teams
        }), { headers });
        
      } catch (error) {
        console.error('Error fetching project teams:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch project teams',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Update user role in project
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/([^\/]+)\/role$/) && method === 'PUT') {
      try {
        const projectId = path.split('/')[4];
        const userId = path.split('/')[6];
        const body = await request.json();
        const { role } = body;
        
        console.log('[DEBUG] Updating user role:', { projectId, userId, role });
        
        if (!role || !['member', 'leader'].includes(role)) {
          return new Response(JSON.stringify({
            success: false,
            error: '無效的角色'
          }), { status: 400, headers });
        }
        
        const result = await env.DB_ENGINEERING.prepare(`
          UPDATE project_users 
          SET role = ? 
          WHERE project_id = ? AND user_id = ?
        `).bind(role, projectId, userId).run();
        
        if (result.meta.changes > 0) {
          return new Response(JSON.stringify({
            success: true,
            message: '角色更新成功'
          }), { headers });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: '找不到該用戶'
        }), { status: 404, headers });
        
      } catch (error) {
        console.error('Error updating user role:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update role',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Create new worker
    if (path === '/api/v1/workers/create' && method === 'POST') {
      try {
        const body = await request.json();
        const { name, nickname, phone, password, email, team_id } = body;
        
        console.log('[DEBUG] Creating new worker:', { name, phone, team_id });
        
        if (!name || !phone || !team_id) {
          return new Response(JSON.stringify({
            success: false,
            error: '姓名、電話和工班為必填項目'
          }), { status: 400, headers });
        }
        
        // 檢查手機號碼在該工班中的唯一性
        const existingWorker = await env.DB_CRM.prepare(`
          SELECT _id, name FROM object_50hj8__c 
          WHERE phone_number__c = ? 
            AND field_D1087__c = ?
            AND is_deleted = 0 
            AND life_status = 'normal'
          LIMIT 1
        `).bind(phone, team_id).first();
        
        if (existingWorker) {
          return new Response(JSON.stringify({
            success: false,
            error: `手機號碼 ${phone} 在此工班中已存在（${existingWorker.name}）`
          }), { status: 400, headers });
        }
        
        // 生成唯一 ID
        const workerId = 'worker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 獲取工班名稱
        let teamName = null;
        try {
          const team = await env.DB_CRM.prepare(`
            SELECT name FROM SupplierObj WHERE _id = ?
          `).bind(team_id).first();
          teamName = team ? team.name : null;
        } catch (error) {
          console.error('Error getting team name:', error);
        }
        
        // 插入新師父到 CRM 數據庫
        await env.DB_CRM.prepare(`
          INSERT INTO object_50hj8__c (
            _id, name, abbreviation__c, phone_number__c, 
            field_D1087__c, field_D1087__c__r, email__c,
            is_deleted, life_status, create_time, last_modified_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'normal', datetime('now'), datetime('now'))
        `).bind(
          workerId,
          name,
          nickname || name.slice(-1),
          phone,
          team_id,
          teamName,
          email || null
        ).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '師父創建成功',
          data: {
            worker_id: workerId,
            name: name,
            phone: phone,
            team_id: team_id,
            team_name: teamName
          }
        }), { headers });
        
      } catch (error) {
        console.error('Error creating worker:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create worker',
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