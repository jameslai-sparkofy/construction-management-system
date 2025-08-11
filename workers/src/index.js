/**
 * Construction Management API - Final Version
 * 統一權限管理系統
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle OPTIONS request
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'healthy', timestamp: new Date().toISOString() }, corsHeaders);
      }

      // API v1 routes
      if (path.startsWith('/api/v1/')) {
        const apiPath = path.replace('/api/v1/', '');
        
        // Projects endpoints
        if (apiPath === 'projects' && method === 'POST') {
          return await createProject(request, env, corsHeaders);
        }
        
        if (apiPath.startsWith('projects/')) {
          const projectId = apiPath.split('/')[1];
          
          if (method === 'GET') {
            return await getProject(projectId, env, corsHeaders);
          }
          
          if (method === 'PUT') {
            return await updateProject(projectId, request, env, corsHeaders);
          }
          
          if (method === 'DELETE') {
            return await deleteProject(projectId, env, corsHeaders);
          }
        }
        
        // User authentication
        if (apiPath === 'auth/login' && method === 'POST') {
          return await handleLogin(request, env, corsHeaders);
        }
        
        // Permissions check
        if (apiPath.startsWith('permissions/')) {
          const [, projectId, userId] = apiPath.split('/');
          return await checkPermissions(projectId, userId, env, corsHeaders);
        }
        
        // Team sync
        if (apiPath === 'sync/teams' && method === 'POST') {
          return await syncTeams(request, env, corsHeaders);
        }
        
        // Owner sync
        if (apiPath === 'sync/owners' && method === 'POST') {
          return await syncOwners(request, env, corsHeaders);
        }
      }

      // Demo data creation
      if (path === '/create-demo' && method === 'GET') {
        return await createDemoProject(env, corsHeaders);
      }

      return jsonResponse({ error: 'Endpoint not found' }, corsHeaders, 404);
      
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ 
        error: 'Internal server error', 
        message: error.message,
        stack: error.stack 
      }, corsHeaders, 500);
    }
  }
};

// Helper function for JSON responses
function jsonResponse(data, headers, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers
  });
}

// Create new project
async function createProject(request, env, headers) {
  const data = await request.json();
  
  // Generate project ID
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Start transaction
  const statements = [];
  
  // 1. Insert project
  statements.push(env.DB_ENGINEERING.prepare(`
    INSERT INTO projects (
      id, opportunity_id, name, 
      spc_engineering, cabinet_engineering, permissions,
      status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).bind(
    projectId,
    data.opportunityId || '',
    data.name,
    JSON.stringify(data.spcEngineering || {}),
    JSON.stringify(data.cabinetEngineering || {}),
    JSON.stringify(data.permissions || {}),
    data.createdBy || 'system'
  ));
  
  // 2. Insert team members
  if (data.teams && data.teams.length > 0) {
    for (const team of data.teams) {
      // Create team assignment
      statements.push(env.DB_ENGINEERING.prepare(`
        INSERT INTO project_team_assignments (
          project_id, team_id, team_name, 
          leader_user_id, leader_name, leader_phone,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, 'active')
      `).bind(
        projectId,
        team.id,
        team.name,
        team.leaderUserId || null,
        team.leaderName || null,
        team.leaderPhone || null
      ));
      
      // Add team members
      if (team.members && team.members.length > 0) {
        for (const member of team.members) {
          statements.push(env.DB_ENGINEERING.prepare(`
            INSERT OR IGNORE INTO users (
              id, phone, password_suffix, name, global_role, source_type
            ) VALUES (?, ?, ?, ?, 'worker', 'crm_worker')
          `).bind(
            member.id,
            member.phone || '',
            member.phone ? member.phone.slice(-3) : '000',
            member.name || ''
          ));
          
          statements.push(env.DB_ENGINEERING.prepare(`
            INSERT INTO project_members (
              project_id, user_id, member_type, team_id, role
            ) VALUES (?, ?, 'team', ?, ?)
          `).bind(
            projectId,
            member.id,
            team.id,
            member.id === team.leaderUserId ? 'leader' : 'member'
          ));
        }
      }
    }
  }
  
  // 3. Insert owners
  if (data.owners && data.owners.length > 0) {
    for (const owner of data.owners) {
      statements.push(env.DB_ENGINEERING.prepare(`
        INSERT OR IGNORE INTO users (
          id, phone, password_suffix, name, global_role, source_type
        ) VALUES (?, ?, ?, ?, 'owner', 'crm_contact')
      `).bind(
        owner.id,
        owner.phone || '',
        owner.phone ? owner.phone.slice(-3) : '000',
        owner.name || ''
      ));
      
      statements.push(env.DB_ENGINEERING.prepare(`
        INSERT INTO project_members (
          project_id, user_id, member_type, role
        ) VALUES (?, ?, 'owner', 'viewer')
      `).bind(
        projectId,
        owner.id
      ));
    }
  }
  
  // Execute all statements
  await env.DB_ENGINEERING.batch(statements);
  
  // Log activity
  await env.DB_ENGINEERING.prepare(`
    INSERT INTO project_activity_logs (
      project_id, user_id, action_type, target_type, target_id, changes
    ) VALUES (?, ?, 'create', 'project', ?, ?)
  `).bind(
    projectId,
    data.createdBy || 'system',
    projectId,
    JSON.stringify({ action: 'Project created', data })
  ).run();
  
  return jsonResponse({ 
    success: true, 
    projectId,
    message: 'Project created successfully' 
  }, headers);
}

// Get project by ID
async function getProject(projectId, env, headers) {
  // Get project data
  const project = await env.DB_ENGINEERING.prepare(`
    SELECT * FROM projects WHERE id = ?
  `).bind(projectId).first();
  
  if (!project) {
    return jsonResponse({ error: 'Project not found' }, headers, 404);
  }
  
  // Parse JSON fields
  project.spc_engineering = project.spc_engineering ? JSON.parse(project.spc_engineering) : null;
  project.cabinet_engineering = project.cabinet_engineering ? JSON.parse(project.cabinet_engineering) : null;
  project.permissions = project.permissions ? JSON.parse(project.permissions) : null;
  
  // Get team assignments
  const teams = await env.DB_ENGINEERING.prepare(`
    SELECT * FROM project_team_assignments WHERE project_id = ? AND status = 'active'
  `).bind(projectId).all();
  
  // Get team members
  for (const team of teams.results) {
    const members = await env.DB_ENGINEERING.prepare(`
      SELECT u.*, pm.role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ? AND pm.team_id = ? AND pm.member_type = 'team'
    `).bind(projectId, team.team_id).all();
    
    team.members = members.results;
  }
  
  // Get owners
  const owners = await env.DB_ENGINEERING.prepare(`
    SELECT u.*
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ? AND pm.member_type = 'owner'
  `).bind(projectId).all();
  
  return jsonResponse({
    ...project,
    teams: teams.results,
    owners: owners.results
  }, headers);
}

// Update project
async function updateProject(projectId, request, env, headers) {
  const data = await request.json();
  
  // Check if project exists
  const existing = await env.DB_ENGINEERING.prepare(
    'SELECT id FROM projects WHERE id = ?'
  ).bind(projectId).first();
  
  if (!existing) {
    return jsonResponse({ error: 'Project not found' }, headers, 404);
  }
  
  // Update project
  await env.DB_ENGINEERING.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      spc_engineering = COALESCE(?, spc_engineering),
      cabinet_engineering = COALESCE(?, cabinet_engineering),
      permissions = COALESCE(?, permissions),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name || null,
    data.spcEngineering ? JSON.stringify(data.spcEngineering) : null,
    data.cabinetEngineering ? JSON.stringify(data.cabinetEngineering) : null,
    data.permissions ? JSON.stringify(data.permissions) : null,
    data.status || null,
    projectId
  ).run();
  
  // Update teams if provided
  if (data.teams) {
    // Mark existing teams as inactive
    await env.DB_ENGINEERING.prepare(`
      UPDATE project_team_assignments 
      SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP
      WHERE project_id = ?
    `).bind(projectId).run();
    
    // Insert new teams
    for (const team of data.teams) {
      await env.DB_ENGINEERING.prepare(`
        INSERT OR REPLACE INTO project_team_assignments (
          project_id, team_id, team_name, leader_user_id, leader_name, leader_phone, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'active')
      `).bind(
        projectId,
        team.id,
        team.name,
        team.leaderUserId || null,
        team.leaderName || null,
        team.leaderPhone || null
      ).run();
    }
  }
  
  // Log activity
  await env.DB_ENGINEERING.prepare(`
    INSERT INTO project_activity_logs (
      project_id, user_id, action_type, target_type, target_id, changes
    ) VALUES (?, ?, 'update', 'project', ?, ?)
  `).bind(
    projectId,
    data.updatedBy || 'system',
    projectId,
    JSON.stringify({ action: 'Project updated', data })
  ).run();
  
  return jsonResponse({ 
    success: true, 
    message: 'Project updated successfully' 
  }, headers);
}

// Delete project
async function deleteProject(projectId, env, headers) {
  // Delete will cascade to related tables
  await env.DB_ENGINEERING.prepare(
    'DELETE FROM projects WHERE id = ?'
  ).bind(projectId).run();
  
  return jsonResponse({ 
    success: true, 
    message: 'Project deleted successfully' 
  }, headers);
}

// User login
async function handleLogin(request, env, headers) {
  const { phone, passwordSuffix } = await request.json();
  
  if (!phone || !passwordSuffix) {
    return jsonResponse({ error: 'Phone and password required' }, headers, 400);
  }
  
  // Find user
  const user = await env.DB_ENGINEERING.prepare(`
    SELECT * FROM users 
    WHERE phone = ? AND password_suffix = ?
  `).bind(phone, passwordSuffix).first();
  
  if (!user) {
    return jsonResponse({ error: 'Invalid credentials' }, headers, 401);
  }
  
  // Generate session token
  const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Update user session
  await env.DB_ENGINEERING.prepare(`
    UPDATE users 
    SET session_token = ?, last_login = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(sessionToken, user.id).run();
  
  // Get user's projects
  const projects = await env.DB_ENGINEERING.prepare(`
    SELECT DISTINCT p.*, pm.role, pm.member_type
    FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ? AND p.status = 'active'
  `).bind(user.id).all();
  
  return jsonResponse({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      globalRole: user.global_role
    },
    sessionToken,
    projects: projects.results
  }, headers);
}

// Check permissions
async function checkPermissions(projectId, userId, env, headers) {
  // Get user's role in project
  const member = await env.DB_ENGINEERING.prepare(`
    SELECT * FROM project_members
    WHERE project_id = ? AND user_id = ?
  `).bind(projectId, userId).first();
  
  if (!member) {
    return jsonResponse({ 
      hasAccess: false,
      message: 'User not a member of this project' 
    }, headers);
  }
  
  // Get project permissions
  const project = await env.DB_ENGINEERING.prepare(`
    SELECT permissions FROM projects WHERE id = ?
  `).bind(projectId).first();
  
  const permissions = project.permissions ? JSON.parse(project.permissions) : {};
  
  return jsonResponse({
    hasAccess: true,
    memberType: member.member_type,
    role: member.role,
    teamId: member.team_id,
    permissions
  }, headers);
}

// Sync teams from CRM
async function syncTeams(request, env, headers) {
  const { projectId, sites } = await request.json();
  
  if (!projectId || !sites) {
    return jsonResponse({ error: 'Project ID and sites required' }, headers, 400);
  }
  
  const teamsMap = new Map();
  
  // Extract teams from sites
  for (const site of sites) {
    if (site.teamId && !teamsMap.has(site.teamId)) {
      teamsMap.set(site.teamId, {
        id: site.teamId,
        name: site.teamName || `Team ${site.teamId}`,
        sites: []
      });
    }
    
    if (site.teamId) {
      teamsMap.get(site.teamId).sites.push(site.id);
    }
  }
  
  // Update teams in database
  for (const [teamId, teamData] of teamsMap) {
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO project_team_assignments (
        project_id, team_id, team_name, status
      ) VALUES (?, ?, ?, 'active')
    `).bind(projectId, teamId, teamData.name).run();
  }
  
  // Mark teams without sites as inactive
  const activeTeamIds = Array.from(teamsMap.keys());
  if (activeTeamIds.length > 0) {
    const placeholders = activeTeamIds.map(() => '?').join(',');
    await env.DB_ENGINEERING.prepare(`
      UPDATE project_team_assignments
      SET status = 'inactive_with_pending_work'
      WHERE project_id = ? AND team_id NOT IN (${placeholders})
    `).bind(projectId, ...activeTeamIds).run();
  }
  
  return jsonResponse({
    success: true,
    synced: teamsMap.size,
    teams: Array.from(teamsMap.values())
  }, headers);
}

// Sync owners from CRM
async function syncOwners(request, env, headers) {
  const { projectId, owners } = await request.json();
  
  if (!projectId || !owners) {
    return jsonResponse({ error: 'Project ID and owners required' }, headers, 400);
  }
  
  // Remove existing owners
  await env.DB_ENGINEERING.prepare(`
    DELETE FROM project_members 
    WHERE project_id = ? AND member_type = 'owner'
  `).bind(projectId).run();
  
  // Add new owners
  for (const owner of owners) {
    // Create or update user
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO users (
        id, phone, password_suffix, name, global_role, source_type
      ) VALUES (?, ?, ?, ?, 'owner', 'crm_contact')
    `).bind(
      owner.id,
      owner.phone || '',
      owner.phone ? owner.phone.slice(-3) : '000',
      owner.name || ''
    ).run();
    
    // Add as project member
    await env.DB_ENGINEERING.prepare(`
      INSERT INTO project_members (
        project_id, user_id, member_type, role
      ) VALUES (?, ?, 'owner', 'viewer')
    `).bind(projectId, owner.id).run();
  }
  
  return jsonResponse({
    success: true,
    synced: owners.length
  }, headers);
}

// Create demo project with real 興安西 data
async function createDemoProject(env, headers) {
  const projectId = '650fe201d184e50001102aee';
  
  // Create project
  await env.DB_ENGINEERING.prepare(`
    INSERT OR REPLACE INTO projects (
      id, opportunity_id, name, 
      spc_engineering, cabinet_engineering, permissions,
      status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'system')
  `).bind(
    projectId,
    '650fe201d184e50001102aee',
    '興安西',
    JSON.stringify({
      enabled: true,
      types: ['SPC地板', '塑膠地板', 'SPC牆板'],
      sites: []
    }),
    JSON.stringify({
      enabled: true,
      types: ['浴櫃'],
      sites: []
    }),
    JSON.stringify({
      owners: [],
      fieldPermissions: {
        ownerPhone: { view: true, edit: false },
        ownerName: { view: true, edit: false },
        constructionDate: { view: true, edit: true },
        notes: { view: true, edit: true }
      },
      crossViewEnabled: false
    })
  ).run();
  
  // Create demo teams
  const teams = [
    { id: 'team_1', name: '陳師傅團隊', leaderName: '陳建國', leaderPhone: '0912345678' },
    { id: 'team_2', name: '林師傅團隊', leaderName: '林志明', leaderPhone: '0923456789' },
    { id: 'team_3', name: '王師傅團隊', leaderName: '王大明', leaderPhone: '0934567890' }
  ];
  
  for (const team of teams) {
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO project_team_assignments (
        project_id, team_id, team_name, leader_name, leader_phone, status
      ) VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(projectId, team.id, team.name, team.leaderName, team.leaderPhone).run();
    
    // Create team leader as user
    const leaderId = `user_${team.id}_leader`;
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO users (
        id, phone, password_suffix, name, global_role, source_type
      ) VALUES (?, ?, ?, ?, 'worker', 'crm_worker')
    `).bind(leaderId, team.leaderPhone, team.leaderPhone.slice(-3), team.leaderName).run();
    
    // Add as team member
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO project_members (
        project_id, user_id, member_type, team_id, role
      ) VALUES (?, ?, 'team', ?, 'leader')
    `).bind(projectId, leaderId, team.id).run();
  }
  
  // Create demo owners
  const owners = [
    { id: 'owner_1', name: '張美玲', phone: '0945678901' },
    { id: 'owner_2', name: '李文華', phone: '0956789012' },
    { id: 'owner_3', name: '黃秀英', phone: '0967890123' }
  ];
  
  for (const owner of owners) {
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO users (
        id, phone, password_suffix, name, global_role, source_type
      ) VALUES (?, ?, ?, ?, 'owner', 'crm_contact')
    `).bind(owner.id, owner.phone, owner.phone.slice(-3), owner.name).run();
    
    await env.DB_ENGINEERING.prepare(`
      INSERT OR REPLACE INTO project_members (
        project_id, user_id, member_type, role
      ) VALUES (?, ?, 'owner', 'viewer')
    `).bind(projectId, owner.id).run();
  }
  
  return jsonResponse({
    success: true,
    message: 'Demo project created',
    projectId,
    teams: teams.length,
    owners: owners.length
  }, headers);
}