/**
 * Construction Management API - Unified Version
 * Simple authentication without Clerk
 */

import { handleUserManagementAPI } from './user-management.js';

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

    // Handle OPTIONS
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        version: 'unified-1.0',
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders });
    }

    // Simple login endpoint
    if (path === '/api/v1/login' && method === 'POST') {
      try {
        const body = await request.json();
        const { phone, password } = body;
        
        if (!phone || !password) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Phone and password required'
          }), { status: 400, headers: corsHeaders });
        }
        
        // Test users (password is last 3 digits of phone)
        const testUsers = {
          '0900000001': { id: 'admin_001', name: '系統管理員', role: 'admin' },
          '0912345678': { id: 'foreman_001', name: '張工班長', role: 'foreman' },
          '0987654321': { id: 'owner_001', name: '王業主', role: 'owner' },
          '0955555555': { id: 'worker_001', name: '李師傅', role: 'worker' }
        };
        
        const expectedPassword = phone.slice(-3);
        
        if (testUsers[phone] && password === expectedPassword) {
          const user = testUsers[phone];
          const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Store session in KV if available
          if (env.SESSIONS) {
            await env.SESSIONS.put(token, JSON.stringify({
              ...user,
              phone,
              loginTime: new Date().toISOString()
            }), { expirationTtl: 86400 }); // 24 hours
          }
          
          return new Response(JSON.stringify({
            success: true,
            user: {
              ...user,
              phone
            },
            token
          }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid credentials'
          }), { status: 401, headers: corsHeaders });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Error processing request: ' + error.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    // Get current user
    if (path === '/api/v1/users/me' && method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No authorization token'
        }), { status: 401, headers: corsHeaders });
      }
      
      const token = authHeader.substring(7);
      
      // Check session in KV
      if (env.SESSIONS) {
        const session = await env.SESSIONS.get(token);
        if (session) {
          const user = JSON.parse(session);
          return new Response(JSON.stringify(user), { headers: corsHeaders });
        }
      }
      
      // Fallback for development
      if (token === 'dev-token-for-testing') {
        return new Response(JSON.stringify({
          id: 'admin_001',
          name: '系統管理員',
          phone: '0900000001',
          role: 'admin'
        }), { headers: corsHeaders });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token'
      }), { status: 401, headers: corsHeaders });
    }

    // Get all users in project with their team contexts
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users$/) && method === 'GET') {
      const projectId = path.split('/')[4];
      
      // Return users with team-based context permissions
      return new Response(JSON.stringify([
        {
          user_id: 'admin_001',
          name: '系統管理員',
          phone: '0900000001',
          user_type: 'admin',
          // Admin 不屬於工班，但有所有權限
          team_contexts: [],
          global_permissions: {
            can_view: true,
            can_edit: true,
            can_manage_members: true,
            can_view_other_teams: true
          }
        },
        {
          user_id: 'owner_001',
          name: '王業主',
          phone: '0987654321',
          user_type: 'owner',
          // 業主不屬於工班，但可查看所有
          team_contexts: [],
          global_permissions: {
            can_view: true,
            can_edit: false,
            can_manage_members: false,
            can_view_other_teams: true
          }
        },
        {
          user_id: 'worker_001',
          name: '張師傅',
          phone: '0912345678',
          user_type: 'worker',
          // 張師傅在不同工班有不同角色
          team_contexts: [
            {
              team_id: 'team_A',
              team_name: '泥作工班A',
              role: 'leader',
              // 在A工班是工班長，有管理權限
              permissions: {
                can_view: true,
                can_edit: true,
                can_manage_members: true,
                can_view_other_teams: false
              }
            },
            {
              team_id: 'team_B',
              team_name: '水電工班B',
              role: 'member',
              // 在B工班是成員，沒有管理權限
              permissions: {
                can_view: true,
                can_edit: true,
                can_manage_members: false,
                can_view_other_teams: false
              }
            }
          ]
        },
        {
          user_id: 'worker_002',
          name: '李師傅',
          phone: '0955555555',
          user_type: 'worker',
          team_contexts: [
            {
              team_id: 'team_B',
              team_name: '水電工班B',
              role: 'leader',
              permissions: {
                can_view: true,
                can_edit: true,
                can_manage_members: true,
                can_view_other_teams: false
              }
            }
          ]
        },
        {
          user_id: 'worker_003',
          name: '陳師傅',
          phone: '0911111111',
          user_type: 'worker',
          team_contexts: [
            {
              team_id: 'team_A',
              team_name: '泥作工班A',
              role: 'member',
              permissions: {
                can_view: true,
                can_edit: true,
                can_manage_members: false,
                can_view_other_teams: false
              }
            }
          ]
        }
      ]), { headers: corsHeaders });
    }

    // Get permissions for a specific site (based on team context)
    if (path.match(/^\/api\/v1\/sites\/([^\/]+)\/permissions$/) && method === 'GET') {
      const siteId = path.split('/')[4];
      
      // 模擬查詢案場資料和工班分配
      // 實際應查詢 D1 的 user_site_permissions 視圖
      const siteTeamMapping = {
        'site_001': 'team_A',  // A棟案場分配給A工班
        'site_002': 'team_A',
        'site_003': 'team_B',  // B棟案場分配給B工班
        'site_004': 'team_B'
      };
      
      const teamId = siteTeamMapping[siteId] || 'team_A';
      const authHeader = request.headers.get('Authorization');
      
      // 模擬用戶身份驗證
      // 實際應從 token 解析用戶
      
      // 返回基於工班上下文的權限
      return new Response(JSON.stringify({
        site_id: siteId,
        team_id: teamId,
        // 權限取決於用戶在該工班的角色
        can_view: true,
        can_edit: true,
        can_manage_members: false,  // 根據工班角色決定
        can_view_other_teams: false
      }), { headers: corsHeaders });
    }

    // Projects list endpoint
    if (path === '/api/v1/projects' && method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      // Return test projects
      return new Response(JSON.stringify([
        {
          id: 'test-project-001',
          name: '測試專案 - 台北建案',
          opportunity_id: 'opp_001',
          opportunity_name: '台北建案商機',
          project_code: 'PRJ-2025-001',
          status: 'active',
          start_date: '2025-01-01',
          end_date: '2025-12-31',
          created_at: new Date().toISOString()
        }
      ]), { headers: corsHeaders });
    }

    // Create project permissions
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/permissions$/) && method === 'POST') {
      const projectId = path.split('/')[4];
      const body = await request.json();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Permission created',
        data: body
      }), { headers: corsHeaders });
    }

    // Handle User Management API routes
    if (path.startsWith('/api/v1/users/available/') || 
        path.match(/^\/api\/v1\/projects\/[^\/]+\/users/) ||
        path === '/api/v1/workers/create') {
      const result = await handleUserManagementAPI(request, env, path);
      return new Response(JSON.stringify(result), { 
        status: result.success ? 200 : 400,
        headers: corsHeaders 
      });
    }

    // Default 404
    return new Response(JSON.stringify({
      success: false,
      error: 'Endpoint not found',
      path: path,
      method: method
    }), { status: 404, headers: corsHeaders });
  }
};