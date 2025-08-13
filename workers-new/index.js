/**
 * Construction Management API - Final Version
 * 統一權限管理系統 with Clerk Integration
 */

import { verifyClerkToken, verifyEmergencyCredentials, generateEmergencyToken } from './services/clerkAuth.js';

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
        return jsonResponse({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          version: '2.0.1',
          hasAuth: true
        }, corsHeaders);
      }
      
      // Test endpoint
      if (path === '/api/v1/auth/test') {
        const body = await request.text();
        return jsonResponse({ 
          message: 'Auth test endpoint',
          method: request.method,
          headers: Object.fromEntries(request.headers),
          body: body,
          bodyLength: body.length,
          path: path
        }, corsHeaders);
      }

      // API v1 routes
      if (path.startsWith('/api/v1/')) {
        const apiPath = path.replace('/api/v1/', '');
        
        // Public endpoints (no auth required)
        
        // Clerk authentication endpoint
        if (apiPath === 'auth/clerk/verify' && method === 'POST') {
          return await handleClerkAuth(request, env, corsHeaders);
        }
        
        // Emergency login endpoint (hidden)
        if (apiPath === 'auth/emergency' && method === 'POST') {
          return await handleEmergencyLogin(request, env, corsHeaders);
        }
        
        // Legacy simple auth (will be deprecated)
        if (apiPath === 'auth/login' && method === 'POST') {
          return await handleLogin(request, env, corsHeaders);
        }
        
        if (apiPath === 'auth/verify' && method === 'GET') {
          return await verifyToken(request, env, corsHeaders);
        }
        
        // Protected endpoints (auth required)
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) {
          return jsonResponse({ error: authResult.error }, corsHeaders, 401);
        }
        
        // Projects endpoints
        if (apiPath === 'projects') {
          if (method === 'GET') {
            return await getProjects(env, corsHeaders, authResult.user);
          }
          if (method === 'POST') {
            return await createProject(request, env, corsHeaders);
          }
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
        return await createDemoData(env, corsHeaders);
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

// Authenticate request
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'No authorization token' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // 1. Check emergency token
  if (token.startsWith('emergency_')) {
    if (env.ENABLE_EMERGENCY_LOGIN === 'true') {
      return {
        success: true,
        user: {
          id: 'emergency_admin',
          name: '緊急管理員',
          global_role: 'admin',
          source_type: 'emergency'
        }
      };
    }
  }
  
  // 2. Check development token
  if (env.ENVIRONMENT === 'development' && token === env.DEV_TOKEN) {
    return {
      success: true,
      user: {
        id: 'dev_user',
        name: '開發用戶',
        global_role: 'admin',
        source_type: 'development'
      }
    };
  }
  
  // 3. Removed demo token logic - now uses proper authentication
  
  // 4. Check if it's a session token (both Clerk and regular)
  if (token.startsWith('clerk_sess_') || token.startsWith('sess_')) {
    const user = await env.DB_ENGINEERING.prepare(`
      SELECT id, name, phone, email, global_role, clerk_id 
      FROM users 
      WHERE session_token = ?
    `).bind(token).first();
    
    if (user) {
      return { success: true, user };
    }
  }
  
  // 5. Try verifying as Clerk token
  const clerkResult = await verifyClerkToken(token, env);
  if (clerkResult.success) {
    return { success: true, user: clerkResult.user };
  }
  
  // 6. Legacy session token check
  const user = await env.DB_ENGINEERING.prepare(`
    SELECT id, name, phone, global_role 
    FROM users 
    WHERE session_token = ?
  `).bind(token).first();
  
  if (!user) {
    return { success: false, error: 'Invalid token' };
  }
  
  return { success: true, user };
}

// Verify token endpoint
async function verifyToken(request, env, headers) {
  const authResult = await authenticateRequest(request, env);
  
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.error }, headers, 401);
  }
  
  return jsonResponse({
    success: true,
    user: authResult.user
  }, headers);
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

// Get all projects
async function getProjects(env, headers, user) {
  try {
    // For admin users, show all projects
    // For other users, show only their projects
    let query;
    if (user && user.global_role === 'admin') {
      query = env.DB_ENGINEERING.prepare(`
        SELECT 
          p.id,
          p.opportunity_id,
          p.name,
          p.status,
          p.created_at,
          p.updated_at,
          p.spc_engineering,
          p.cabinet_engineering,
          p.cached_stats
        FROM projects p
        WHERE p.status = 'active'
        ORDER BY p.created_at DESC
      `);
    } else {
      query = env.DB_ENGINEERING.prepare(`
        SELECT DISTINCT
          p.id,
          p.opportunity_id,
          p.name,
          p.status,
          p.created_at,
          p.updated_at,
          p.spc_engineering,
          p.cabinet_engineering,
          p.cached_stats
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.status = 'active' 
          AND (pm.user_id = ? OR p.created_by = ?)
        ORDER BY p.created_at DESC
      `).bind(user?.id || '', user?.id || '');
    }
    
    const { results } = await query.all();
    
    // Process each project
    const projects = results.map(project => {
      // Parse JSON fields
      const spcEng = project.spc_engineering ? JSON.parse(project.spc_engineering) : {};
      const cabinetEng = project.cabinet_engineering ? JSON.parse(project.cabinet_engineering) : {};
      const stats = project.cached_stats ? JSON.parse(project.cached_stats) : {};
      
      // Determine engineering types
      const engineeringTypes = [];
      if (spcEng.enabled) engineeringTypes.push('SPC');
      if (cabinetEng.enabled) engineeringTypes.push('浴櫃');
      
      // Calculate progress
      const totalSites = stats.totalSites || 0;
      const completedSites = stats.completedSites || 0;
      const progress = totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;
      
      return {
        id: project.id,
        name: project.name,
        opportunity_id: project.opportunity_id,
        company: stats.company || '未設定',
        engineeringTypes: engineeringTypes,
        status: 'active',
        progress: progress,
        unit_count: totalSites,
        completed_count: completedSites,
        lastUpdate: project.updated_at ? new Date(project.updated_at).toLocaleDateString('zh-TW') : new Date(project.created_at).toLocaleDateString('zh-TW'),
        created_at: project.created_at
      };
    });
    
    return jsonResponse({
      success: true,
      projects: projects,
      total: projects.length
    }, headers);
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to fetch projects',
      message: error.message
    }, headers, 500);
  }
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

// Clerk authentication handler
async function handleClerkAuth(request, env, headers) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return jsonResponse({
        success: false,
        error: 'Token is required'
      }, headers, 400);
    }
    
    const result = await verifyClerkToken(token, env);
    
    if (result.success) {
      return jsonResponse({
        success: true,
        user: result.user,
        sessionToken: result.sessionToken,
        clerkUser: result.clerkUser
      }, headers);
    }
    
    return jsonResponse({
      success: false,
      error: result.error
    }, headers, 401);
    
  } catch (error) {
    console.error('Clerk auth error:', error);
    return jsonResponse({
      success: false,
      error: 'Authentication failed: ' + error.message
    }, headers, 500);
  }
}

// Emergency login handler
async function handleEmergencyLogin(request, env, headers) {
  // Check if emergency login is enabled
  if (env.ENABLE_EMERGENCY_LOGIN !== 'true') {
    return jsonResponse({ error: 'Not found' }, headers, 404);
  }
  
  try {
    const { phone, code } = await request.json();
    
    if (!phone || !code) {
      return jsonResponse({
        success: false,
        error: 'Phone and code are required'
      }, headers, 400);
    }
    
    const result = verifyEmergencyCredentials(phone, code, env);
    
    if (result.success) {
      // Log emergency login for audit
      console.warn('EMERGENCY LOGIN:', {
        phone: phone,
        timestamp: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP')
      });
      
      return jsonResponse(result, headers);
    }
    
    return jsonResponse({
      success: false,
      error: 'Invalid emergency credentials'
    }, headers, 401);
    
  } catch (error) {
    console.error('Emergency login error:', error);
    return jsonResponse({
      success: false,
      error: 'Emergency login failed'
    }, headers, 500);
  }
}

// Legacy simple login (to be deprecated)
async function handleLogin(request, env, headers) {
  // Clone request to avoid consuming it
  const requestClone = request.clone();
  let phone, password;
  
  try {
    const bodyText = await requestClone.text();
    console.log('Login request body:', bodyText);
    
    if (!bodyText) {
      return jsonResponse({ 
        success: false,
        error: 'Empty request body' 
      }, headers, 400);
    }
    
    const body = JSON.parse(bodyText);
    phone = body.phone;
    password = body.password;
  } catch (error) {
    return jsonResponse({ 
      success: false,
      error: 'Invalid JSON body: ' + error.message
    }, headers, 400);
  }
  
  if (!phone || !password) {
    return jsonResponse({ 
      success: false,
      error: 'Phone and password required',
      debug: { phone: !!phone, password: !!password }
    }, headers, 400);
  }
  
  // Extract last 3 digits as password suffix
  const passwordSuffix = password.slice(-3);
  
  // Find user
  const user = await env.DB_ENGINEERING.prepare(`
    SELECT * FROM users 
    WHERE phone = ? AND password_suffix = ?
  `).bind(phone, passwordSuffix).first();
  
  if (!user) {
    return jsonResponse({ 
      success: false,
      error: 'Invalid credentials' 
    }, headers, 401);
  }
  
  // Generate session token
  const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Update user session
  await env.DB_ENGINEERING.prepare(`
    UPDATE users 
    SET session_token = ?, last_login = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(sessionToken, user.id).run();
  
  return jsonResponse({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.global_role
      },
      token: sessionToken
    }
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

// Create demo data including admin user
async function createDemoData(env, headers) {
  // First, create admin user
  await env.DB_ENGINEERING.prepare(`
    INSERT OR REPLACE INTO users (
      id, phone, password_suffix, name, global_role, source_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    'admin',
    '0912345678',
    '678',
    '系統管理員',
    'admin',
    'system'
  ).run();
  
  // Continue with demo project creation
  return await createDemoProject(env, headers);
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