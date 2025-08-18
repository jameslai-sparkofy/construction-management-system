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
    
    // Get current user endpoint
    if (path === '/api/v1/users/me' && method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Unauthorized' 
        }), {
          status: 401,
          headers
        });
      }
      
      // 從 token 中解析用戶資訊
      const token = authHeader.substring(7);
      
      // 簡單的 token 解析（實際應該使用 JWT 驗證）
      // 這裡我們假設 token 格式為: phone-timestamp
      const [phone] = token.split('-');
      
      // 根據電話號碼查詢用戶
      if (phone === '0912345678') {
        return new Response(JSON.stringify({
          id: 'admin',
          name: '系統管理員',
          role: 'admin',
          user_type: 'admin',
          phone: '0912345678'
        }), {
          headers
        });
      } else if (phone === '0900000001') {
        return new Response(JSON.stringify({
          id: 'admin2',
          name: '管理員2',
          role: 'admin',
          user_type: 'admin',
          phone: '0900000001'
        }), {
          headers
        });
      } else {
        // 預設返回一般用戶
        return new Response(JSON.stringify({
          id: 'user_' + phone,
          name: '用戶',
          role: 'member',
          user_type: 'member',
          phone: phone
        }), {
          headers
        });
      }
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
        
        // Start transaction
        const statements = [];
        
        // 1. Insert project into projects table
        statements.push(env.DB_ENGINEERING.prepare(`
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
        ));
        
        // 2. Insert users records for owners
        if (data.permissions?.owners) {
          for (const owner of data.permissions.owners) {
            const userId = owner.userId || `user_${owner.phone}_${Date.now()}`;
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO users (
                user_id, name, phone, project_id, team_id, role,
                source_type, source_id, created_by
              ) VALUES (?, ?, ?, ?, NULL, 'owner', 'crm_contact', ?, ?)
            `).bind(
              userId,
              owner.name || 'Unknown',
              owner.phone || '',
              projectId,
              owner.userId || '',
              data.createdBy || 'system'
            ));
          }
        }
        
        // 3. Insert users records for team leaders
        if (data.permissions?.teamLeaders) {
          for (const leader of data.permissions.teamLeaders) {
            const userId = leader.userId || `user_${leader.phone}_${Date.now()}`;
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO users (
                user_id, name, phone, project_id, team_id, role,
                source_type, source_id, created_by
              ) VALUES (?, ?, ?, ?, ?, 'team_leader', 'crm_worker', ?, ?)
            `).bind(
              userId,
              leader.name || 'Unknown',
              leader.phone || '',
              projectId,
              leader.teamId || '',
              leader.userId || '',
              data.createdBy || 'system'
            ));
          }
        }
        
        // 4. Insert users records for team members  
        if (data.permissions?.teamMembers) {
          for (const member of data.permissions.teamMembers) {
            const userId = member.userId || `user_${member.phone}_${Date.now()}`;
            statements.push(env.DB_ENGINEERING.prepare(`
              INSERT INTO users (
                user_id, name, phone, project_id, team_id, role,
                source_type, source_id, created_by
              ) VALUES (?, ?, ?, ?, ?, 'team_member', 'crm_worker', ?, ?)
            `).bind(
              userId,
              member.name || 'Unknown',
              member.phone || '',
              projectId,
              member.teamId || '',
              member.userId || '',
              data.createdBy || 'system'
            ));
          }
        }
        
        // Execute all INSERT statements individually to avoid batch transaction rollback
        console.log(`[DEBUG] Executing ${statements.length} INSERT statements individually`);
        
        let successCount = 0;
        let failCount = 0;
        
        // Execute each statement individually
        for (let i = 0; i < statements.length; i++) {
          try {
            await statements[i].run();
            successCount++;
            console.log(`[DEBUG] Statement ${i} executed successfully`);
          } catch (stmtError) {
            failCount++;
            console.error(`[DEBUG] Statement ${i} failed:`, stmtError.message);
            // Continue with next statement instead of stopping
          }
        }
        
        console.log(`[DEBUG] Execution complete: ${successCount} success, ${failCount} failed`)
        
        // 5. Process teams with can_view_other_teams permission (UPDATE after INSERT)
        if (data.permissions?.teams) {
          for (const team of data.permissions.teams) {
            if (team.canViewOthers && team.leaders) {
              // Update team leaders with view permission
              for (const leaderId of team.leaders) {
                try {
                  await env.DB_ENGINEERING.prepare(`
                    UPDATE users 
                    SET can_view_other_teams = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND project_id = ? AND team_id = ?
                  `).bind(leaderId, projectId, team.name).run();
                  console.log(`[DEBUG] Updated view permission for ${leaderId}`);
                } catch (updateError) {
                  console.error(`[DEBUG] Failed to update view permission for ${leaderId}:`, updateError);
                }
              }
            }
          }
        }
        
        console.log('[DEBUG] Project and users created successfully:', projectId);
        
        return new Response(JSON.stringify({
          success: true,
          project: {
            id: projectId,
            name: data.name,
            opportunity_id: data.opportunityId || data.opportunity_id,
            created_at: new Date().toISOString()
          },
          message: `專案建立成功，已新增 ${successCount - 1} 位使用者`
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
        
        // Return in the format expected by frontend (without 'project' wrapper for compatibility)
        return new Response(JSON.stringify({
          ...projectData,
          success: true,
          // Also include the wrapped format for backward compatibility
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
    
    // Get project teams and members
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+\/teams$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting teams for project:', projectId);
        
        // Query all users for this project
        const query = env.DB_ENGINEERING.prepare(`
          SELECT 
            u.id,
            u.user_id,
            u.name,
            u.phone,
            u.team_id,
            u.role,
            u.can_view_other_teams,
            u.source_type,
            u.source_id,
            u.is_active,
            u.created_at
          FROM users u
          WHERE u.project_id = ? AND u.is_active = 1
          ORDER BY u.team_id, u.role, u.name
        `);
        
        const { results } = await query.bind(projectId).all();
        
        // Group users by team
        const teams = {};
        const noTeamUsers = [];
        
        for (const user of results) {
          if (user.team_id) {
            if (!teams[user.team_id]) {
              teams[user.team_id] = {
                id: user.team_id,
                name: user.team_id,
                members: [],
                leaders: [],
                memberCount: 0
              };
            }
            
            const member = {
              id: user.id,
              userId: user.user_id,
              name: user.name,
              phone: user.phone,
              role: user.role,
              canViewOtherTeams: user.can_view_other_teams,
              sourceType: user.source_type,
              sourceId: user.source_id
            };
            
            teams[user.team_id].members.push(member);
            teams[user.team_id].memberCount++;
            
            if (user.role === 'team_leader') {
              teams[user.team_id].leaders.push(member);
            }
          } else {
            // Users without team (owners, admins)
            noTeamUsers.push({
              id: user.id,
              userId: user.user_id,
              name: user.name,
              phone: user.phone,
              role: user.role,
              sourceType: user.source_type,
              sourceId: user.source_id
            });
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          teams: Object.values(teams),
          projectUsers: noTeamUsers,
          totalUsers: results.length
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error fetching teams:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch teams',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Debug endpoint for CRM queries
    if (path === '/api/v1/debug/crm-workers' && method === 'GET') {
      try {
        const query = env.DB_CRM.prepare(`
          SELECT _id, name, shift_time__c, shift_time__c__r
          FROM object_50hj8__c
          WHERE name = '賴俊穎'
          LIMIT 5
        `);
        
        const { results } = await query.all();
        
        return new Response(JSON.stringify({
          success: true,
          data: results,
          debug: true
        }), { headers });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          debug: true
        }), { headers });
      }
    }

    // Get workers for a specific team from CRM
    if (path.match(/^\/api\/v1\/teams\/[^\/]+\/workers$/) && method === 'GET') {
      try {
        const teamId = path.split('/')[4];
        console.log('[DEBUG] Getting workers for team ID:', teamId);
        
        // Step 1: Get team name from SupplierObj using the ID
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
            console.log('[DEBUG] Found team name from SupplierObj:', teamName);
          } else {
            console.log('[DEBUG] No team found in SupplierObj with ID:', teamId);
          }
        } catch (supplierError) {
          console.error('[DEBUG] Error querying SupplierObj:', supplierError);
        }
        
        // If we can't find the team name, use the ID as fallback
        const searchTerm = teamName || teamId;
        console.log('[DEBUG] Searching for workers with term:', searchTerm);
        
        // Step 2: Query workers using field_D1087__c (team ID) or field_D1087__c__r (team name)
        const query = env.DB_CRM.prepare(`
          SELECT 
            _id as id,
            name,
            field_D1087__c as team_id_field,
            field_D1087__c__r as team_name_field,
            phone_number__c,
            abbreviation__c,
            owner,
            create_time,
            last_modified_time
          FROM object_50hj8__c
          WHERE (field_D1087__c__r LIKE ? OR field_D1087__c = ?)
            AND is_deleted = 0
            AND life_status = 'normal'
          ORDER BY name
        `);
        
        const { results } = await query.bind(`%${searchTerm}%`, teamId).all();
        console.log('[DEBUG] CRM query results:', results);
        console.log('[DEBUG] Results length:', results ? results.length : 'null/undefined');
        
        // 如果沒有結果，返回空數組
        if (!results || results.length === 0) {
          console.log('[DEBUG] No workers found for team:', teamId);
          return new Response(JSON.stringify({
            success: true,
            data: [],
            total: 0
          }), { headers });
        }
        
        // 轉換為前端需要的格式
        const workers = results.map(worker => ({
          user_id: `crm_worker_${worker.id}`,
          name: worker.name || '未命名',
          phone: worker.phone_number__c || '',
          nickname: worker.abbreviation__c || (worker.name ? worker.name.slice(-1) : ''),
          email: '',
          team_id: worker.team_id_field || teamId,
          team_name: worker.team_name_field || teamName || '',
          source_type: 'crm_worker',
          source_id: worker.id
        }));
        
        return new Response(JSON.stringify({
          success: true,
          data: workers,
          total: workers.length
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error fetching team workers:', error);
        
        // 如果查詢失敗，返回模擬資料
        const mockWorkers = getMockWorkersForTeam(path.split('/')[4]);
        return new Response(JSON.stringify({
          success: true,
          data: mockWorkers,
          total: mockWorkers.length,
          mock: true
        }), { headers });
      }
    }
    
    // Add team member
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+\/teams\/[^\/]+\/members$/) && method === 'POST') {
      try {
        const parts = path.split('/');
        const projectId = parts[4];
        const teamId = parts[6];
        const data = await request.json();
        
        console.log('[DEBUG] Adding team member:', { projectId, teamId, data });
        
        // Insert new team member
        const insertQuery = env.DB_ENGINEERING.prepare(`
          INSERT INTO users (
            user_id, name, phone, project_id, team_id, role,
            source_type, source_id, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const userId = data.userId || `user_${data.phone}_${Date.now()}`;
        
        await insertQuery.bind(
          userId,
          data.name,
          data.phone,
          projectId,
          teamId,
          data.role || 'team_member',
          data.sourceType || 'crm_supplier',
          data.sourceId || '',
          data.createdBy || 'system'
        ).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '成員已新增',
          member: {
            userId,
            name: data.name,
            phone: data.phone,
            teamId,
            role: data.role || 'team_member'
          }
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error adding team member:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to add team member',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Delete team member
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+\/teams\/[^\/]+\/members\/[^\/]+$/) && method === 'DELETE') {
      try {
        const parts = path.split('/');
        const projectId = parts[4];
        const teamId = parts[6];
        const userId = parts[8];
        
        console.log('[DEBUG] Removing team member:', { projectId, teamId, userId });
        
        // Soft delete - mark as inactive
        const deleteQuery = env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND project_id = ? AND team_id = ?
        `);
        
        await deleteQuery.bind(userId, projectId, teamId).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '成員已移除'
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error removing team member:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to remove team member',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Update team member
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+\/teams\/[^\/]+\/members\/[^\/]+$/) && method === 'PUT') {
      try {
        const parts = path.split('/');
        const projectId = parts[4];
        const teamId = parts[6];
        const userId = parts[8];
        const data = await request.json();
        
        console.log('[DEBUG] Updating team member:', { projectId, teamId, userId, data });
        
        // Build update query dynamically
        const updateFields = [];
        const values = [];
        
        if (data.name !== undefined) {
          updateFields.push('name = ?');
          values.push(data.name);
        }
        
        if (data.phone !== undefined) {
          updateFields.push('phone = ?');
          values.push(data.phone);
        }
        
        if (data.role !== undefined) {
          updateFields.push('role = ?');
          values.push(data.role);
        }
        
        if (data.canViewOtherTeams !== undefined) {
          updateFields.push('can_view_other_teams = ?');
          values.push(data.canViewOtherTeams ? 1 : 0);
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        values.push(userId, projectId, teamId);
        
        const updateQuery = env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET ${updateFields.join(', ')}
          WHERE user_id = ? AND project_id = ? AND team_id = ?
        `);
        
        await updateQuery.bind(...values).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '成員資料已更新'
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error updating team member:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update team member',
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
    
    // Teams endpoint - 返回專案實際使用的工班
    if (path === '/api/v1/teams' && method === 'GET') {
      try {
        const url = new URL(request.url);
        const projectId = url.searchParams.get('project_id');
        
        if (projectId) {
          // 如果有 project_id，返回該專案實際使用的工班
          // TODO: 實際應該從案場資料統計出使用的工班
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
          // 沒有 project_id 時返回所有工班
          const query = env.DB_CRM.prepare(`
            SELECT DISTINCT
              _id as id,
              name,
              tel as phone
            FROM supplierobj
            WHERE is_deleted = 0
            AND life_status = 'normal'
            ORDER BY name
          `);
          
          const { results } = await query.all();
          
          return new Response(JSON.stringify({
            success: true,
            data: results || []
          }), { headers });
        }
      } catch (error) {
        console.error('[DEBUG] Error fetching teams:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch teams',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get available admins - 從 employees_simple 取得真實管理員資料
    if (path === '/api/v1/users/available/admins' && method === 'GET') {
      try {
        const query = env.DB_CRM.prepare(`
          SELECT 
            open_user_id as user_id,
            name,
            mobile as phone,
            email,
            main_department_id as department
          FROM employees_simple
          ORDER BY name
        `);
        
        const { results } = await query.all();
        
        return new Response(JSON.stringify({
          success: true,
          data: results || []
        }), { headers });
      } catch (error) {
        console.error('[DEBUG] Error fetching admins:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch admins',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get available workers - 從 object_50hj8__c 取得真實師父資料，按工班過濾
    if (path === '/api/v1/users/available/workers' && method === 'GET') {
      try {
        const url = new URL(request.url);
        const teamId = url.searchParams.get('team_id');
        const teamName = url.searchParams.get('team_name');
        
        let query = `
          SELECT 
            _id as user_id,
            name,
            phone_number__c as phone,
            owner__r,
            owner_department as department,
            shift_time__c as team_id,
            shift_time__c__r as team_name,
            field_iL2BT__c as role
          FROM object_50hj8__c
          WHERE is_deleted = 0
          AND life_status = 'normal'
        `;
        
        const params = [];
        if (teamId) {
          // 根據工班 ID 過濾
          query += ` AND shift_time__c = ?`;
          params.push(teamId);
        } else if (teamName) {
          // 根據工班名稱過濾
          query += ` AND shift_time__c__r = ?`;
          params.push(teamName);
        }
        
        query += ` ORDER BY name`;
        
        const stmt = params.length > 0 ? 
          env.DB_CRM.prepare(query).bind(...params) :
          env.DB_CRM.prepare(query);
          
        const { results } = await stmt.all();
        
        return new Response(JSON.stringify({
          success: true,
          data: results || []
        }), { headers });
      } catch (error) {
        console.error('[DEBUG] Error fetching workers:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch workers',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get available owners - 從 newopportunitycontactsobj 取得真實業主資料
    if (path === '/api/v1/users/available/owners' && method === 'GET') {
      try {
        const url = new URL(request.url);
        const opportunityId = url.searchParams.get('opportunity_id');
        
        const query = opportunityId ? 
          `SELECT 
            _id as user_id,
            contact_id__r as name,
            '' as phone,
            '' as email,
            '' as role
          FROM newopportunitycontactsobj
          WHERE new_opportunity_id__relation_ids = ?
          AND is_deleted = 0
          AND life_status = 'normal'
          ORDER BY contact_id__r` :
          `SELECT 
            _id as user_id,
            contact_id__r as name,
            '' as phone,
            '' as email,
            '' as role,
            new_opportunity_id__relation_ids as opportunity_id
          FROM newopportunitycontactsobj
          WHERE is_deleted = 0
          AND life_status = 'normal'
          ORDER BY contact_id__r`;

        const stmt = opportunityId ? 
          env.DB_CRM.prepare(query).bind(opportunityId) :
          env.DB_CRM.prepare(query);

        const { results } = await stmt.all();

        return new Response(JSON.stringify({
          success: true,
          data: results || []
        }), { headers });
      } catch (error) {
        console.error('[DEBUG] Error fetching owners:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch owners',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get project teams - 取得專案實際使用的工班
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+\/teams$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting teams for project:', projectId);
        
        // 從專案的案場中統計實際使用的工班
        // 這應該從 sites 表或其他地方查詢，現在先返回示例資料
        const projectTeams = [
          { id: '66a21ce3f0032b000142088f', name: '周華龍工班', count: 297 },
          { id: '66a3651be4a03100013b9a6f', name: '樂邁(工班)-愛德美特有限公司', count: 70 },
          { id: '66bbed4c1ca88f0001c83bc9', name: '莊聰源師傅/菲米裝潢工程行', count: 60 }
        ];
        
        return new Response(JSON.stringify({
          success: true,
          teams: projectTeams
        }), { headers });
      } catch (error) {
        console.error('[DEBUG] Error fetching project teams:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch project teams',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get project teams - 從專案用戶表提取工班資訊
    if (path.match(/^\/api\/v1\/projects\/[^\/]+\/teams$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting teams for project:', projectId);
        
        // 從 project_users 表獲取工班資訊
        const { results } = await env.DB_ENGINEERING.prepare(`
          SELECT DISTINCT 
            team_id, 
            team_name,
            COUNT(*) as member_count
          FROM project_users 
          WHERE project_id = ? 
            AND team_id IS NOT NULL 
            AND team_name IS NOT NULL
          GROUP BY team_id, team_name
          ORDER BY team_name
        `).bind(projectId).all();
        
        console.log('[DEBUG] Teams found:', results);
        
        // 轉換為前端需要的格式
        const teams = results.map(team => ({
          id: team.team_id,
          name: team.team_name,
          memberCount: team.member_count,
          members: [] // 這裡不載入成員詳情，需要時再查詢
        }));
        
        return new Response(JSON.stringify({
          success: true,
          teams: teams,
          total: teams.length
        }), { headers });
        
      } catch (error) {
        console.error('[DEBUG] Error getting project teams:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get project teams',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get project users - 從 users 表取得真實專案用戶資料  
    if (path.match(/^\/api\/v1\/projects\/proj_[^\/]+\/users$/) && method === 'GET') {
      try {
        const projectId = path.split('/')[4];
        console.log('[DEBUG] Getting users for project:', projectId);
        
        // Query all users for this project
        const query = env.DB_ENGINEERING.prepare(`
          SELECT 
            u.id,
            u.user_id,
            u.name,
            u.phone,
            u.team_id,
            u.role,
            u.can_view_other_teams,
            u.source_type,
            u.source_id,
            u.is_active
          FROM users u
          WHERE u.project_id = ? AND u.is_active = 1
          ORDER BY u.role, u.name
        `);
        
        const { results } = await query.bind(projectId).all();
        
        if (!results || results.length === 0) {
          // 如果沒有用戶，返回空結構
          return new Response(JSON.stringify({
            success: true,
            data: {
              all: [],
              grouped: {
                admins: [],
                owners: [],
                teams: []
              }
            }
          }), { headers });
        }
        
        // 分組用戶
        const admins = results.filter(u => u.role === 'admin' || u.source_type === 'employees_simple');
        const owners = results.filter(u => u.role === 'owner' || u.source_type === 'crm_contact');
        const workers = results.filter(u => u.role === 'team_member' || u.role === 'team_leader' || u.source_type === 'crm_worker');
        
        // 按工班分組工人
        const teamGroups = {};
        workers.forEach(worker => {
          const teamId = worker.team_id || 'no_team';
          if (!teamGroups[teamId]) {
            teamGroups[teamId] = {
              team_id: teamId,
              team_name: teamId, // 實際應從 SupplierObj 查詢工班名稱
              members: []
            };
          }
          teamGroups[teamId].members.push({
            user_id: worker.user_id,
            name: worker.name,
            phone: worker.phone,
            role: worker.role || 'member',
            can_view_other_teams: worker.can_view_other_teams
          });
        });
        
        // 查詢工班名稱
        if (Object.keys(teamGroups).length > 0) {
          const teamIds = Object.keys(teamGroups).filter(id => id !== 'no_team');
          if (teamIds.length > 0) {
            const teamQuery = env.DB_CRM.prepare(`
              SELECT _id, name 
              FROM supplierobj 
              WHERE _id IN (${teamIds.map(() => '?').join(',')})
            `);
            const teamResults = await teamQuery.bind(...teamIds).all();
            
            // 更新工班名稱
            if (teamResults.results) {
              teamResults.results.forEach(team => {
                if (teamGroups[team._id]) {
                  teamGroups[team._id].team_name = team.name;
                }
              });
            }
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            all: results.map(u => ({
              user_id: u.user_id,
              name: u.name,
              phone: u.phone,
              user_type: u.role === 'admin' ? 'admin' : 
                        u.role === 'owner' ? 'owner' : 'worker',
              user_role: u.role,
              team_id: u.team_id,
              can_view_all: u.can_view_other_teams,
              can_edit_all: 0,
              can_add_members: u.role === 'admin' || u.role === 'team_leader' ? 1 : 0,
              can_add_leaders: u.role === 'admin' ? 1 : 0
            })),
            grouped: {
              admins: admins.map(u => ({
                user_id: u.user_id,
                name: u.name,
                phone: u.phone
              })),
              owners: owners.map(u => ({
                user_id: u.user_id,
                name: u.name,
                phone: u.phone
              })),
              teams: Object.values(teamGroups)
            }
          }
        }), { headers });
      } catch (error) {
        console.error('[DEBUG] Error fetching project users:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch project users',
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
    
    // Add user to project endpoint - 使用 project_members 表（根據文檔）
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
        
        // 根據文檔，使用 project_members 表進行統一權限管理
        // member_type: 'team' 或 'owner'
        const memberType = user_type === 'owner' ? 'owner' : 'team';
        const role = user_role || (user_type === 'owner' ? 'viewer' : 'member');
        
        // 檢查是否已存在
        const existing = await env.DB_ENGINEERING.prepare(`
          SELECT id FROM project_members 
          WHERE project_id = ? AND user_id = ? AND team_id = ?
        `).bind(projectId, user_id, team_id || null).first();
        
        if (existing) {
          return new Response(JSON.stringify({
            success: false,
            error: '該用戶已在專案中'
          }), { status: 400, headers });
        }
        
        // 先確保 users 表有該用戶資料
        const existingUser = await env.DB_ENGINEERING.prepare(`
          SELECT id FROM users WHERE phone = ?
        `).bind(phone).first();
        
        if (!existingUser) {
          // 插入到 users 表
          await env.DB_ENGINEERING.prepare(`
            INSERT INTO users (
              id, phone, name, email,
              global_role, source_type, source_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            user_id, phone, name, email,
            user_type === 'admin' ? 'admin' : 'worker',
            source_table, user_id
          ).run();
        }
        
        // 插入到 project_members 表
        await env.DB_ENGINEERING.prepare(`
          INSERT INTO project_members (
            project_id, user_id, member_type, team_id, role,
            created_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          projectId, user_id, memberType, 
          team_id || null, role
        ).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '用戶添加成功',
          data: {
            project_id: projectId,
            user_id,
            name,
            member_type: memberType,
            role
          }
        }), { headers });
      } catch (error) {
        console.error('Error adding user to project:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), { status: 500, headers });
      }
    }
    
    // Create new worker endpoint - 添加重複檢查
    if (path === '/api/v1/workers/create' && method === 'POST') {
      try {
        const body = await request.json();
        const { name, phone, email, nickname, password, team_id } = body;
        
        // 根據要求：檢查同一電話是否已在同一工班
        // 需要先找到 team_id 對應的工班名稱
        let teamName = '';
        if (team_id) {
          const teamResult = await env.DB_CRM.prepare(`
            SELECT name FROM supplierobj 
            WHERE _id = ? AND is_deleted = 0
          `).bind(team_id).first();
          
          if (teamResult) {
            teamName = teamResult.name;
          }
        }
        
        // 檢查是否已存在相同電話在同一工班
        const existingWorker = await env.DB_CRM.prepare(`
          SELECT _id, name FROM object_50hj8__c 
          WHERE phone_number__c = ? 
          AND shift_time__c__r = ?
          AND is_deleted = 0
          AND life_status = 'normal'
        `).bind(phone, teamName).first();
        
        if (existingWorker) {
          return new Response(JSON.stringify({
            success: false,
            error: `該電話號碼已存在於 ${teamName} 工班中（師父：${existingWorker.name}）`,
            message: '師父已存在'
          }), { status: 400, headers });
        }
        
        // 生成工人ID
        const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 插入到 CRM 的 object_50hj8__c 表
        // 注意：shift_time__c 存 team_id，shift_time__c__r 存工班名稱
        await env.DB_CRM.prepare(`
          INSERT INTO object_50hj8__c (
            _id, name, phone_number__c, create_time, 
            life_status, is_deleted, shift_time__c, shift_time__c__r
          ) VALUES (?, ?, ?, ?, 'normal', 0, ?, ?)
        `).bind(
          workerId, name, phone, Date.now(), 
          team_id || '', teamName
        ).run();
        
        // 同時插入到 DB_ENGINEERING 的 users 表
        await env.DB_ENGINEERING.prepare(`
          INSERT OR IGNORE INTO users (
            id, phone, name, email,
            global_role, source_type, source_id, created_at
          ) VALUES (?, ?, ?, ?, 'worker', 'crm_worker', ?, datetime('now'))
        `).bind(
          workerId, phone, name, email, workerId
        ).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '師父創建成功',
          data: {
            worker_id: workerId,
            name,
            phone,
            team: teamName,
            nickname: nickname || name?.slice(-1)
          }
        }), { headers });
      } catch (error) {
        console.error('Error creating worker:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), { status: 500, headers });
      }
    }
    
    return new Response(JSON.stringify({ 
      error: 'Not found',
      path: path
    }), { status: 404, headers });
  }
};