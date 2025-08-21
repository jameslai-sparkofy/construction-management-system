/**
 * 工程管理系統 API - Simplified Version
 * 使用單一 project_users 表的簡化設計
 */

import { FxCrmSyncService } from './services/fxCrmSyncService.js';
import { FileService } from './services/fileService.js';

// 直接在檔案中實作認證邏輯

// 簡化的認證工具類
class AuthUtils {
  constructor(env) {
    this.env = env;
    this.jwtSecret = env.JWT_SECRET || 'default-jwt-secret';
  }

  // 標準化手機號碼
  normalizePhone(phone) {
    if (!phone) return null;
    
    // 移除所有非數字字符
    let cleaned = phone.replace(/\D/g, '');
    
    // 處理國碼
    if (cleaned.startsWith('886')) {
      cleaned = '0' + cleaned.substring(3);
    }
    
    // 確保是 10 位數並以 09 開頭
    if (cleaned.length === 10 && cleaned.startsWith('09')) {
      return cleaned;
    }
    
    return null;
  }

  // 生成簡化的 token
  generateToken(user) {
    const payload = {
      user_id: user.id,
      phone: user.phone,
      role: user.global_role,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30天
    };
    
    // 簡化的 token (使用 TextEncoder 處理 UTF-8)
    const tokenData = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(tokenData);
    const base64String = btoa(String.fromCharCode(...data));
    return 'jwt_' + base64String + '_' + Date.now();
  }

  // 驗證 token
  verifyToken(token) {
    try {
      if (!token || !token.startsWith('jwt_')) {
        return { valid: false, error: 'Invalid token format' };
      }
      
      const parts = token.split('_');
      if (parts.length < 3) {
        return { valid: false, error: 'Invalid token structure' };
      }
      
      const encodedPayload = parts[1];
      // 使用 TextDecoder 處理 UTF-8
      const decodedBytes = atob(encodedPayload);
      const bytes = new Uint8Array(decodedBytes.length);
      for (let i = 0; i < decodedBytes.length; i++) {
        bytes[i] = decodedBytes.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(bytes);
      const payload = JSON.parse(jsonString);
      
      // 檢查過期
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Token expired' };
      }
      
      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: 'Token verification failed' };
    }
  }

  // 登入驗證
  async login(phone, password) {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: '手機號碼格式不正確' };
      }

      // 查詢用戶
      const user = await this.env.DB_ENGINEERING.prepare(`
        SELECT id, phone, password_suffix, name, email, global_role, 
               is_active, user_status
        FROM users 
        WHERE phone = ? AND is_active = 1
      `).bind(normalizedPhone).first();

      if (!user) {
        return { success: false, error: '用戶不存在或已停用' };
      }

      // 檢查用戶狀態
      if (user.user_status === 'suspended') {
        return { success: false, error: '帳號已暫停使用' };
      }

      // 驗證密碼
      if (user.password_suffix !== password) {
        return { success: false, error: '密碼錯誤' };
      }

      // 生成 token
      const token = this.generateToken(user);

      // 更新登入資訊
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET last_login = ?, 
            login_count = login_count + 1,
            session_token = ?
        WHERE id = ?
      `).bind(
        new Date().toISOString(),
        token,
        user.id
      ).run();

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.global_role,
            user_type: user.global_role
          },
          token: token,
          expires_in: 30 * 24 * 3600 // 30天
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: `登入失敗: ${error.message}` };
    }
  }

  // 用戶同步機制 - 當在專案中新增用戶時，檢查並同步到 users 表
  async syncUserToUsersTable(phone, name, sourceType = 'manual', sourceId = null) {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: '手機號碼格式不正確' };
      }

      // 檢查用戶是否已存在於 users 表
      const existingUser = await this.env.DB_ENGINEERING.prepare(`
        SELECT id, phone, name, global_role, is_active 
        FROM users 
        WHERE phone = ?
      `).bind(normalizedPhone).first();

      if (existingUser) {
        // 用戶已存在，更新資訊
        if (existingUser.is_active === 0) {
          // 重新啟用停用的用戶
          await this.env.DB_ENGINEERING.prepare(`
            UPDATE users 
            SET is_active = 1, 
                name = COALESCE(?, name),
                updated_at = CURRENT_TIMESTAMP
            WHERE phone = ?
          `).bind(name, normalizedPhone).run();
        } else if (name && name !== existingUser.name) {
          // 更新用戶名稱
          await this.env.DB_ENGINEERING.prepare(`
            UPDATE users 
            SET name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE phone = ?
          `).bind(name, normalizedPhone).run();
        }

        return { 
          success: true, 
          user: {
            id: existingUser.id,
            phone: normalizedPhone,
            name: name || existingUser.name,
            role: existingUser.global_role
          },
          action: 'updated'
        };
      } else {
        // 創建新用戶
        const newUserId = 'user_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
        const passwordSuffix = normalizedPhone.slice(-3); // 預設密碼為手機後3碼

        await this.env.DB_ENGINEERING.prepare(`
          INSERT INTO users (
            id, phone, password_suffix, name, global_role,
            source_type, source_id, is_active, is_verified, user_status,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'pending', CURRENT_TIMESTAMP)
        `).bind(
          newUserId,
          normalizedPhone,
          passwordSuffix,
          name || '未命名用戶',
          'user', // 預設為一般用戶
          sourceType,
          sourceId
        ).run();

        return { 
          success: true, 
          user: {
            id: newUserId,
            phone: normalizedPhone,
            name: name || '未命名用戶',
            role: 'user'
          },
          action: 'created'
        };
      }
    } catch (error) {
      console.error('User sync error:', error);
      return { success: false, error: `用戶同步失敗: ${error.message}` };
    }
  }

  // 批量用戶同步
  async batchSyncUsers(userList) {
    const results = {
      successful: [],
      failed: []
    };

    for (const userData of userList) {
      const result = await this.syncUserToUsersTable(
        userData.phone, 
        userData.name, 
        userData.sourceType || 'manual',
        userData.sourceId
      );

      if (result.success) {
        results.successful.push({
          ...result.user,
          action: result.action
        });
      } else {
        results.failed.push({
          phone: userData.phone,
          name: userData.name,
          error: result.error
        });
      }
    }

    return results;
  }
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

    // 快取標頭設定函數
    const addCacheHeaders = (responseHeaders, cacheType = 'api') => {
      const newHeaders = { ...responseHeaders };
      
      switch (cacheType) {
        case 'static':
          // 靜態資源：1天快取
          newHeaders['Cache-Control'] = 'public, max-age=86400, s-maxage=86400';
          newHeaders['Expires'] = new Date(Date.now() + 86400000).toUTCString();
          break;
        case 'api-short':
          // 短期API快取：5分鐘
          newHeaders['Cache-Control'] = 'public, max-age=300, s-maxage=300';
          break;
        case 'api-medium':
          // 中期API快取：1小時
          newHeaders['Cache-Control'] = 'public, max-age=3600, s-maxage=3600';
          break;
        case 'no-cache':
          // 不快取
          newHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          newHeaders['Pragma'] = 'no-cache';
          newHeaders['Expires'] = '0';
          break;
        default:
          // 預設API快取：10分鐘
          newHeaders['Cache-Control'] = 'public, max-age=600, s-maxage=600';
      }
      
      return newHeaders;
    };
    
    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    // Health check
    if (path === '/health' || path === '/') {
      const healthHeaders = addCacheHeaders(headers, 'api-short');
      return new Response(JSON.stringify({ 
        name: '工程管理系統 API (Simplified)',
        status: 'healthy',
        version: '1.0.0-simple',
        timestamp: new Date().toISOString()
      }), { headers: healthHeaders });
    }
    
    // 初始化認證工具
    const authUtils = new AuthUtils(env);
    
    // 權限檢查函數
    async function checkAuth(request) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return { authenticated: false, error: 'No authorization header' };
      }
      
      const tokenResult = authUtils.verifyToken(authHeader.replace('Bearer ', ''));
      if (!tokenResult.valid) {
        return { authenticated: false, error: tokenResult.error };
      }
      
      // 從 token 中獲取用戶資訊
      const verification = {
        valid: true,
        user: {
          id: tokenResult.payload.user_id,
          name: tokenResult.payload.name,
          phone: tokenResult.payload.phone,
          role: tokenResult.payload.role,
          user_type: tokenResult.payload.role
        }
      };
      
      return { authenticated: true, user: verification.user };
    }
    
    // 真實用戶登入
    if (path === '/api/v1/auth/login' && method === 'POST') {
      try {
        const body = await request.json();
        const { phone, password } = body;
        
        const result = await authUtils.login(phone, password);
        
        if (result.success) {
          const authHeaders = addCacheHeaders(headers, 'no-cache');
          return new Response(JSON.stringify(result), { headers: authHeaders });
        } else {
          const errorHeaders = addCacheHeaders(headers, 'no-cache');
          return new Response(JSON.stringify(result), { 
            status: 401, 
            headers: errorHeaders 
          });
        }
      } catch (error) {
        console.error('Login API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: '登入系統錯誤'
        }), { status: 500, headers });
      }
    }
    
    // 登出
    if (path === '/api/v1/auth/logout' && method === 'POST') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No authorization header'
          }), { status: 401, headers });
        }
        
        // 簡化的登出處理
        const result = { success: true };
        const logoutHeaders = addCacheHeaders(headers, 'no-cache');
        return new Response(JSON.stringify(result), { headers: logoutHeaders });
      } catch (error) {
        console.error('Logout API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Logout failed'
        }), { status: 500, headers });
      }
    }

    // 優化的認證端點：一次性獲取完整 session 資訊
    if (path === '/api/v1/auth/session' && method === 'GET') {
      try {
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const user = authCheck.user;
        
        // 獲取用戶權限和專案列表
        const projectsQuery = await env.DB_ENGINEERING.prepare(`
          SELECT DISTINCT 
            p.id, p.name, p.status, p.opportunity_id,
            pu.user_type, pu.role as project_role
          FROM projects p
          LEFT JOIN project_users pu ON p.id = pu.project_id
          WHERE pu.user_id = ? OR ? = 'super_admin'
          ORDER BY p.name
        `).bind(user.user_id, user.role).all();

        const projects = projectsQuery.results || [];
        
        // 構建權限映射
        const permissions = {};
        projects.forEach(project => {
          permissions[project.id] = {
            user_type: project.user_type,
            role: project.project_role,
            can_view: true,
            can_edit: project.user_type === 'admin' || project.project_role === 'leader',
            can_manage_members: project.user_type === 'admin'
          };
        });

        return new Response(JSON.stringify({
          success: true,
          user: user,
          projects: projects,
          permissions: permissions,
          timestamp: new Date().toISOString()
        }), { headers });

      } catch (error) {
        console.error('Session API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get session info'
        }), { status: 500, headers });
      }
    }

    // 優化的專案摘要端點：包含案場統計
    if (path === '/api/v1/projects/summary' && method === 'GET') {
      try {
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const user = authCheck.user;
        
        // 根據權限獲取專案列表
        let projectsQuery;
        if (user.role === 'super_admin') {
          // Super admin 可以看到所有專案
          projectsQuery = await env.DB_ENGINEERING.prepare(`
            SELECT * FROM projects ORDER BY created_at DESC
          `).all();
        } else {
          // 一般用戶只能看到有權限的專案
          projectsQuery = await env.DB_ENGINEERING.prepare(`
            SELECT DISTINCT p.* 
            FROM projects p
            INNER JOIN project_users pu ON p.id = pu.project_id
            WHERE pu.user_id = ?
            ORDER BY p.created_at DESC
          `).bind(user.user_id).all();
        }

        const projects = projectsQuery.results || [];
        
        // 為每個專案獲取案場統計（使用子查詢優化）
        const projectsWithStats = [];
        
        for (const project of projects) {
          try {
            // 獲取案場統計
            const sitesResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?field_1P96q__c=${project.opportunity_id}&limit=1000`, {
              headers: {
                'Authorization': 'Bearer fx-crm-api-secret-2025'
              }
            });
            
            if (sitesResponse.ok) {
              const sitesData = await sitesResponse.json();
              const sites = sitesData.results || [];
              
              const totalSites = sites.length;
              const completedSites = sites.filter(site => 
                site.status === 'completed' || 
                site.construction_status === 'completed' ||
                site.spc_status === 'completed' ||
                site.construction_completed__c === true ||
                site.construction_completed__c === 1 ||
                site.construction_completed__c === '1'
              ).length;
              
              const inProgressSites = sites.filter(site => 
                site.status === 'in_progress' || 
                site.construction_status === 'in_progress' ||
                site.spc_status === 'in_progress'
              ).length;
              
              const progressPercent = totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;
              
              let calculatedStatus;
              if (totalSites === 0 || completedSites === 0) {
                calculatedStatus = 'not_started';
              } else if (completedSites === totalSites) {
                calculatedStatus = 'completed';
              } else {
                calculatedStatus = 'in_progress';
              }
              
              projectsWithStats.push({
                ...project,
                calculated_status: calculatedStatus,
                calculated_progress: progressPercent,
                site_stats: {
                  totalSites,
                  completedSites,
                  inProgressSites,
                  pendingSites: totalSites - completedSites - inProgressSites
                }
              });
            } else {
              // 如果無法獲取案場資料，使用預設值
              projectsWithStats.push({
                ...project,
                calculated_status: 'not_started',
                calculated_progress: 0,
                site_stats: {
                  totalSites: 0,
                  completedSites: 0,
                  inProgressSites: 0,
                  pendingSites: 0
                }
              });
            }
          } catch (error) {
            console.warn(`Failed to get stats for project ${project.id}:`, error);
            projectsWithStats.push({
              ...project,
              calculated_status: 'not_started',
              calculated_progress: 0,
              site_stats: {
                totalSites: 0,
                completedSites: 0,
                inProgressSites: 0,
                pendingSites: 0
              }
            });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          projects: projectsWithStats,
          total: projectsWithStats.length,
          generated_at: new Date().toISOString()
        }), { headers });

      } catch (error) {
        console.error('Projects summary API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get projects summary'
        }), { status: 500, headers });
      }
    }

    // 優化的專案詳情端點：一次性獲取完整專案資訊
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/detail$/) && method === 'GET') {
      try {
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const projectId = path.split('/')[4];
        const user = authCheck.user;

        // 獲取專案基本資訊
        const project = await env.DB_ENGINEERING.prepare(`
          SELECT * FROM projects WHERE id = ?
        `).bind(projectId).first();

        if (!project) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project not found'
          }), { status: 404, headers });
        }

        // 檢查權限
        const hasPermission = user.role === 'super_admin' || user.role === 'admin';
        if (!hasPermission) {
          const userProject = await env.DB_ENGINEERING.prepare(`
            SELECT * FROM project_users WHERE project_id = ? AND user_id = ?
          `).bind(projectId, user.user_id).first();
          
          if (!userProject) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Access denied'
            }), { status: 403, headers });
          }
        }

        // 並行獲取相關資料
        const [sitesResponse, usersQuery, statsQuery] = await Promise.all([
          // 獲取案場資料
          fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?field_1P96q__c=${project.opportunity_id}&limit=1000`, {
            headers: { 'Authorization': 'Bearer fx-crm-api-secret-2025' }
          }),
          
          // 獲取專案用戶
          env.DB_ENGINEERING.prepare(`
            SELECT 
              pu.*,
              u.name as user_name,
              u.phone as user_phone,
              u.email as user_email
            FROM project_users pu
            LEFT JOIN users u ON pu.user_id = u.id
            WHERE pu.project_id = ?
            ORDER BY pu.user_type, pu.team_name, pu.name
          `).bind(projectId).all(),
          
          // 獲取專案統計
          env.DB_ENGINEERING.prepare(`
            SELECT 
              COUNT(*) as total_users,
              SUM(CASE WHEN user_type = 'admin' THEN 1 ELSE 0 END) as admin_count,
              SUM(CASE WHEN user_type = 'owner' THEN 1 ELSE 0 END) as owner_count,
              SUM(CASE WHEN user_type = 'worker' THEN 1 ELSE 0 END) as worker_count
            FROM project_users 
            WHERE project_id = ?
          `).bind(projectId).first()
        ]);

        // 處理案場資料
        let sites = [];
        let sitesStats = {
          totalSites: 0,
          completedSites: 0,
          inProgressSites: 0,
          pendingSites: 0
        };

        if (sitesResponse.ok) {
          const sitesData = await sitesResponse.json();
          sites = sitesData.results || [];
          
          sitesStats.totalSites = sites.length;
          sitesStats.completedSites = sites.filter(site => 
            site.status === 'completed' || 
            site.construction_status === 'completed' ||
            site.construction_completed__c === true
          ).length;
          sitesStats.inProgressSites = sites.filter(site => 
            site.status === 'in_progress' || 
            site.construction_status === 'in_progress'
          ).length;
          sitesStats.pendingSites = sitesStats.totalSites - sitesStats.completedSites - sitesStats.inProgressSites;
        }

        // 處理用戶資料
        const users = usersQuery.results || [];
        const groupedUsers = {
          admins: users.filter(u => u.user_type === 'admin'),
          owners: users.filter(u => u.user_type === 'owner'),
          workers: users.filter(u => u.user_type === 'worker')
        };

        // 組織工班資料
        const teams = {};
        groupedUsers.workers.forEach(worker => {
          if (worker.team_id) {
            if (!teams[worker.team_id]) {
              teams[worker.team_id] = {
                id: worker.team_id,
                name: worker.team_name || worker.team_id,
                members: []
              };
            }
            teams[worker.team_id].members.push(worker);
          }
        });

        return new Response(JSON.stringify({
          success: true,
          project: {
            ...project,
            calculated_progress: sitesStats.totalSites > 0 ? 
              Math.round((sitesStats.completedSites / sitesStats.totalSites) * 100) : 0
          },
          sites: sites,
          sitesStats: sitesStats,
          users: groupedUsers,
          teams: Object.values(teams),
          userStats: statsQuery || {
            total_users: 0,
            admin_count: 0,
            owner_count: 0,
            worker_count: 0
          },
          permissions: {
            canEdit: hasPermission,
            canManageUsers: hasPermission,
            canViewAllSites: hasPermission
          },
          loadedAt: new Date().toISOString()
        }), { headers: addCacheHeaders(headers, 'api-short') });

      } catch (error) {
        console.error('Project detail API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get project detail',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // 優化的案場詳情端點：一次性獲取完整案場資訊
    if (path.match(/^\/api\/v1\/sites\/([^\/]+)\/detail$/) && method === 'GET') {
      try {
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const siteId = path.split('/')[4];
        const user = authCheck.user;

        // 首先從 D1 API 獲取案場基本資訊
        const siteResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c/${siteId}`, {
          headers: { 'Authorization': 'Bearer fx-crm-api-secret-2025' }
        });

        if (!siteResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Site not found'
          }), { status: 404, headers });
        }

        const siteData = await siteResponse.json();
        const site = siteData.result;

        if (!site) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Site data not available'
          }), { status: 404, headers });
        }

        // 獲取關聯的專案資訊
        let project = null;
        let hasPermission = user.role === 'super_admin' || user.role === 'admin';

        if (site.field_1P96q__c) {
          try {
            const projectQuery = await env.DB_ENGINEERING.prepare(`
              SELECT * FROM projects WHERE opportunity_id = ?
            `).bind(site.field_1P96q__c).first();
            
            project = projectQuery;
            
            // 檢查用戶是否有該專案權限
            if (!hasPermission && project) {
              const userProject = await env.DB_ENGINEERING.prepare(`
                SELECT * FROM project_users WHERE project_id = ? AND user_id = ?
              `).bind(project.id, user.user_id).first();
              
              hasPermission = !!userProject;
            }
          } catch (projectError) {
            console.warn('Failed to load project info:', projectError);
          }
        }

        if (!hasPermission) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied to this site'
          }), { status: 403, headers });
        }

        // 並行獲取相關資料
        const [photosResponse, workersQuery, historyQuery] = await Promise.all([
          // 獲取照片（如果有相關 API）
          Promise.resolve({ ok: false }), // 暫時返回空，後續可連接照片 API
          
          // 獲取該專案的工班資訊
          project ? env.DB_ENGINEERING.prepare(`
            SELECT 
              pu.*,
              u.name as user_name,
              u.phone as user_phone
            FROM project_users pu
            LEFT JOIN users u ON pu.user_id = u.id
            WHERE pu.project_id = ? AND pu.user_type = 'worker'
            ORDER BY pu.team_name, pu.name
          `).bind(project.id).all() : Promise.resolve({ results: [] }),
          
          // 獲取工程歷史記錄（從 D1 相關表獲取，如果有的話）
          Promise.resolve({ results: [] }) // 暫時返回空
        ]);

        // 處理照片資料
        let photos = [];
        if (photosResponse.ok) {
          const photosData = await photosResponse.json();
          photos = photosData.results || [];
        }

        // 處理工班資料
        const workers = workersQuery.results || [];
        const teams = {};
        workers.forEach(worker => {
          if (worker.team_id) {
            if (!teams[worker.team_id]) {
              teams[worker.team_id] = {
                id: worker.team_id,
                name: worker.team_name || worker.team_id,
                members: []
              };
            }
            teams[worker.team_id].members.push(worker);
          }
        });

        // 處理工程歷史
        const history = historyQuery.results || [];

        // 計算案場狀態
        let calculatedStatus = 'pending';
        if (site.status === 'completed' || 
            site.construction_status === 'completed' ||
            site.construction_completed__c === true) {
          calculatedStatus = 'completed';
        } else if (site.status === 'in_progress' || 
                   site.construction_status === 'in_progress') {
          calculatedStatus = 'in_progress';
        }

        return new Response(JSON.stringify({
          success: true,
          site: {
            ...site,
            calculated_status: calculatedStatus
          },
          project: project,
          workers: workers,
          teams: Object.values(teams),
          photos: photos,
          history: history,
          permissions: {
            canEdit: hasPermission,
            canUploadPhotos: hasPermission,
            canManageWorkers: user.role === 'super_admin' || user.role === 'admin'
          },
          loadedAt: new Date().toISOString()
        }), { headers });

      } catch (error) {
        console.error('Site detail API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get site detail',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // 優化的用戶管理端點：一次性獲取完整用戶管理資料
    if (path === '/api/v1/admin/users/complete' && method === 'GET') {
      try {
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const user = authCheck.user;
        
        // 檢查管理員權限 (支持多個角色字段)
        const userRole = user.role || user.global_role || user.user_type;
        if (!['admin', 'super_admin'].includes(userRole)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied - admin privileges required'
          }), { status: 403, headers });
        }

        // 並行獲取所有用戶管理相關資料
        const [usersQuery, projectsQuery, userProjectsQuery, statsQuery] = await Promise.all([
          // 獲取所有用戶
          env.DB_ENGINEERING.prepare(`
            SELECT 
              u.*,
              COUNT(DISTINCT pu.project_id) as project_count,
              GROUP_CONCAT(DISTINCT p.name) as project_names
            FROM users u
            LEFT JOIN project_users pu ON u.id = pu.user_id
            LEFT JOIN projects p ON pu.project_id = p.id
            GROUP BY u.id
            ORDER BY u.global_role, u.name
          `).all(),
          
          // 獲取所有專案（用於分配用戶）
          env.DB_ENGINEERING.prepare(`
            SELECT 
              id, 
              name, 
              opportunity_id,
              COUNT(pu.user_id) as user_count
            FROM projects p
            LEFT JOIN project_users pu ON p.id = pu.project_id
            GROUP BY p.id
            ORDER BY p.name
          `).all(),
          
          // 獲取用戶-專案關聯
          env.DB_ENGINEERING.prepare(`
            SELECT 
              pu.*,
              u.name as user_name,
              u.phone as user_phone,
              u.global_role,
              p.name as project_name
            FROM project_users pu
            LEFT JOIN users u ON pu.user_id = u.id
            LEFT JOIN projects p ON pu.project_id = p.id
            ORDER BY p.name, pu.user_type, pu.name
          `).all(),
          
          // 獲取統計資料
          env.DB_ENGINEERING.prepare(`
            SELECT 
              COUNT(*) as total_users,
              SUM(CASE WHEN global_role = 'super_admin' THEN 1 ELSE 0 END) as super_admin_count,
              SUM(CASE WHEN global_role = 'admin' THEN 1 ELSE 0 END) as admin_count,
              SUM(CASE WHEN global_role = 'user' THEN 1 ELSE 0 END) as user_count,
              (SELECT COUNT(DISTINCT project_id) FROM project_users) as active_projects,
              (SELECT COUNT(*) FROM project_users) as total_assignments
            FROM users
          `).first()
        ]);

        const users = usersQuery.results || [];
        const projects = projectsQuery.results || [];
        const userProjects = userProjectsQuery.results || [];
        const stats = statsQuery || {};

        // 按角色分組用戶
        const usersByRole = {
          super_admin: users.filter(u => u.global_role === 'super_admin'),
          admin: users.filter(u => u.global_role === 'admin'),
          user: users.filter(u => u.global_role === 'user' || !u.global_role)
        };

        // 組織專案-用戶關聯
        const projectUserMap = {};
        userProjects.forEach(pu => {
          if (!projectUserMap[pu.project_id]) {
            projectUserMap[pu.project_id] = {
              project_name: pu.project_name,
              users: []
            };
          }
          projectUserMap[pu.project_id].users.push(pu);
        });

        // 組織用戶-專案關聯
        const userProjectMap = {};
        userProjects.forEach(pu => {
          if (!userProjectMap[pu.user_id]) {
            userProjectMap[pu.user_id] = [];
          }
          userProjectMap[pu.user_id].push({
            project_id: pu.project_id,
            project_name: pu.project_name,
            user_type: pu.user_type,
            team_id: pu.team_id,
            team_name: pu.team_name
          });
        });

        // 計算用戶活動統計
        const userStats = users.map(user => {
          const userProjectCount = userProjectMap[user.id]?.length || 0;
          return {
            ...user,
            project_assignments: userProjectCount,
            projects: userProjectMap[user.id] || []
          };
        });

        return new Response(JSON.stringify({
          success: true,
          users: userStats,
          usersByRole: usersByRole,
          projects: projects,
          userProjects: userProjects,
          projectUserMap: projectUserMap,
          userProjectMap: userProjectMap,
          stats: {
            totalUsers: stats.total_users || 0,
            superAdminCount: stats.super_admin_count || 0,
            adminCount: stats.admin_count || 0,
            userCount: stats.user_count || 0,
            activeProjects: stats.active_projects || 0,
            totalAssignments: stats.total_assignments || 0
          },
          permissions: {
            canCreateUsers: true,
            canDeleteUsers: user.role === 'super_admin',
            canManageRoles: user.role === 'super_admin',
            canAssignProjects: true
          },
          loadedAt: new Date().toISOString()
        }), { headers });

      } catch (error) {
        console.error('User management API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to load user management data',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get current user
    if (path === '/api/v1/users/me' && method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }
        
        const tokenResult = authUtils.verifyToken(authHeader.replace('Bearer ', ''));
        if (!tokenResult.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: tokenResult.error
          }), { status: 401, headers });
        }
        
        const verification = {
          user: {
            id: tokenResult.payload.user_id,
            name: tokenResult.payload.name,
            phone: tokenResult.payload.phone,
            role: tokenResult.payload.role,
            user_type: tokenResult.payload.role
          }
        };
        
        return new Response(JSON.stringify({
          success: true,
          user: verification.user
        }), { headers });
      } catch (error) {
        console.error('Get user API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get user info'
        }), { status: 500, headers });
      }
    }
    
    // 更新用戶個人資料
    if (path === '/api/v1/users/me' && method === 'PUT') {
      try {
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }
        
        const body = await request.json();
        const { name, email } = body;
        
        // 更新用戶資料
        const updateFields = [];
        const values = [];
        
        if (name) {
          updateFields.push('name = ?');
          values.push(name);
        }
        
        if (email) {
          updateFields.push('email = ?');
          values.push(email);
        }
        
        if (updateFields.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: '沒有提供需要更新的資料'
          }), { status: 400, headers });
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(auth.user.id);
        
        await env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `).bind(...values).run();
        
        // 獲取更新後的用戶資料
        const updatedUser = await env.DB_ENGINEERING.prepare(`
          SELECT id, phone, name, email, global_role, user_status, last_login, login_count
          FROM users 
          WHERE id = ?
        `).bind(auth.user.id).first();
        
        return new Response(JSON.stringify({
          success: true,
          message: '用戶資料更新成功',
          user: {
            id: updatedUser.id,
            phone: updatedUser.phone,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.global_role,
            user_type: updatedUser.global_role,
            user_status: updatedUser.user_status,
            last_login: updatedUser.last_login,
            login_count: updatedUser.login_count
          }
        }), { headers });
        
      } catch (error) {
        console.error('Update user profile error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update user profile',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // 修改密碼
    if (path === '/api/v1/users/change-password' && method === 'POST') {
      try {
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }
        
        const body = await request.json();
        const { current_password, new_password } = body;
        
        if (!current_password || !new_password) {
          return new Response(JSON.stringify({
            success: false,
            error: '請提供目前密碼和新密碼'
          }), { status: 400, headers });
        }
        
        // 驗證新密碼格式 (應為3位數字)
        if (!/^\d{3}$/.test(new_password)) {
          return new Response(JSON.stringify({
            success: false,
            error: '新密碼必須為3位數字'
          }), { status: 400, headers });
        }
        
        // 獲取用戶當前密碼
        const user = await env.DB_ENGINEERING.prepare(`
          SELECT password_suffix FROM users WHERE id = ?
        `).bind(auth.user.id).first();
        
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: '用戶不存在'
          }), { status: 404, headers });
        }
        
        // 驗證當前密碼
        if (user.password_suffix !== current_password) {
          return new Response(JSON.stringify({
            success: false,
            error: '目前密碼不正確'
          }), { status: 400, headers });
        }
        
        // 更新密碼
        await env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET password_suffix = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(new_password, auth.user.id).run();
        
        return new Response(JSON.stringify({
          success: true,
          message: '密碼修改成功'
        }), { headers });
        
      } catch (error) {
        console.error('Change password error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to change password',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // 獲取用戶在各專案中的角色
    if (path === '/api/v1/users/me/projects' && method === 'GET') {
      try {
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }
        
        // 查詢用戶參與的專案和角色
        const { results } = await env.DB_ENGINEERING.prepare(`
          SELECT 
            p.id as project_id,
            p.name as project_name,
            p.status as project_status,
            pu.user_type,
            pu.role,
            pu.team_id,
            pu.team_name,
            pu.added_at
          FROM project_users pu
          INNER JOIN projects p ON pu.project_id = p.id
          WHERE pu.phone = ? AND p.status = 'active'
          ORDER BY pu.added_at DESC
        `).bind(auth.user.phone).all();
        
        const projects = results.map(proj => ({
          project_id: proj.project_id,
          project_name: proj.project_name,
          project_status: proj.project_status,
          user_role: proj.user_type,
          team_role: proj.role,
          team_id: proj.team_id,
          team_name: proj.team_name,
          joined_at: proj.added_at
        }));
        
        return new Response(JSON.stringify({
          success: true,
          projects: projects,
          total: projects.length
        }), { headers });
        
      } catch (error) {
        console.error('Get user projects error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get user projects',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // Get projects
    if (path === '/api/v1/projects' && method === 'GET') {
      try {
        // 檢查認證
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: auth.error
          }), { status: 401, headers });
        }
        
        // 根據用戶角色獲取專案
        let query;
        if (auth.user.role === 'super_admin') {
          // Super Admin 可以看所有專案
          query = env.DB_ENGINEERING.prepare(`
            SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC
          `);
        } else {
          // 其他用戶只能看參與的專案
          query = env.DB_ENGINEERING.prepare(`
            SELECT DISTINCT p.* FROM projects p
            INNER JOIN project_users pu ON p.id = pu.project_id
            WHERE p.status = 'active' 
              AND pu.phone = ?
            ORDER BY p.created_at DESC
          `);
        }
        
        const { results } = auth.user.role === 'super_admin' 
          ? await query.all()
          : await query.bind(auth.user.phone).all();
        
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
        
        // 同步用戶到 users 表
        if (phone) {
          const syncResult = await authUtils.syncUserToUsersTable(
            phone, 
            name, 
            source_table === 'employees_simple' ? 'system' : 
            source_table?.startsWith('object_') ? 'crm_worker' : 'manual',
            sourceId
          );
          
          if (!syncResult.success) {
            console.warn('用戶同步失敗，但繼續添加到專案:', syncResult.error);
          } else {
            console.log('用戶同步成功:', syncResult.action, syncResult.user.id);
          }
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
    
    // 用戶同步管理 API 端點
    
    // 手動同步單個用戶到 users 表
    if (path === '/api/v1/users/sync' && method === 'POST') {
      try {
        // 檢查認證
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: auth.error
          }), { status: 401, headers });
        }
        
        // 只有管理員可以執行同步
        if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
          return new Response(JSON.stringify({
            success: false,
            error: '權限不足，只有管理員可以執行用戶同步'
          }), { status: 403, headers });
        }
        
        const body = await request.json();
        const { phone, name, sourceType, sourceId } = body;
        
        if (!phone) {
          return new Response(JSON.stringify({
            success: false,
            error: '手機號碼為必填項目'
          }), { status: 400, headers });
        }
        
        const result = await authUtils.syncUserToUsersTable(phone, name, sourceType, sourceId);
        
        const syncHeaders = addCacheHeaders(headers, 'no-cache');
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: syncHeaders
        });
        
      } catch (error) {
        console.error('User sync API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to sync user',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // 批量同步專案用戶到 users 表
    if (path === '/api/v1/users/batch-sync' && method === 'POST') {
      try {
        // 檢查認證
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: auth.error
          }), { status: 401, headers });
        }
        
        // 只有管理員可以執行批量同步
        if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
          return new Response(JSON.stringify({
            success: false,
            error: '權限不足，只有管理員可以執行批量同步'
          }), { status: 403, headers });
        }
        
        const body = await request.json();
        const { users } = body;
        
        if (!users || !Array.isArray(users)) {
          return new Response(JSON.stringify({
            success: false,
            error: '用戶清單格式不正確'
          }), { status: 400, headers });
        }
        
        const results = await authUtils.batchSyncUsers(users);
        
        return new Response(JSON.stringify({
          success: true,
          results: results,
          summary: {
            total: users.length,
            successful: results.successful.length,
            failed: results.failed.length
          }
        }), { headers });
        
      } catch (error) {
        console.error('Batch sync API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to batch sync users',
          message: error.message
        }), { status: 500, headers });
      }
    }
    
    // 從 project_users 自動同步所有用戶到 users 表
    if (path === '/api/v1/users/sync-from-projects' && method === 'POST') {
      try {
        // 檢查認證
        const auth = await checkAuth(request);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: auth.error
          }), { status: 401, headers });
        }
        
        // 只有 Super Admin 可以執行全量同步
        if (auth.user.role !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: '權限不足，只有 Super Admin 可以執行全量同步'
          }), { status: 403, headers });
        }
        
        // 獲取所有 project_users 中的唯一用戶
        const { results } = await env.DB_ENGINEERING.prepare(`
          SELECT DISTINCT 
            phone, name, source_table, source_id
          FROM project_users 
          WHERE phone IS NOT NULL 
            AND trim(phone) != ''
            AND phone NOT IN ('0912345678', '0963922033')
        `).all();
        
        const userList = results.map(user => ({
          phone: user.phone,
          name: user.name,
          sourceType: user.source_table === 'employees_simple' ? 'system' :
                     user.source_table?.startsWith('object_') ? 'crm_worker' : 'manual',
          sourceId: user.source_id
        }));
        
        const syncResults = await authUtils.batchSyncUsers(userList);
        
        return new Response(JSON.stringify({
          success: true,
          message: '專案用戶同步完成',
          results: syncResults,
          summary: {
            total: userList.length,
            successful: syncResults.successful.length,
            failed: syncResults.failed.length
          }
        }), { headers });
        
      } catch (error) {
        console.error('Project users sync API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to sync project users',
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
        
        // 檢查手機號碼在該工班中的唯一性（如果 env.DB_CRM 可用）
        let existingWorker = null;
        try {
          if (env.DB_CRM) {
            existingWorker = await env.DB_CRM.prepare(`
              SELECT _id, name FROM object_50hj8__c 
              WHERE phone_number__c = ? 
                AND field_D1087__c = ?
                AND is_deleted = 0 
                AND life_status = 'normal'
              LIMIT 1
            `).bind(phone, team_id).first();
          }
        } catch (error) {
          console.error('Error checking existing worker:', error);
          // 繼續處理，不因檢查失敗而中斷
        }
        
        if (existingWorker) {
          return new Response(JSON.stringify({
            success: false,
            error: `手機號碼 ${phone} 在此工班中已存在（${existingWorker.name}）`
          }), { status: 400, headers });
        }
        
        // 生成唯一 ID
        const workerId = 'worker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 獲取工班名稱（如果 env.DB_CRM 可用）
        let teamName = null;
        try {
          if (env.DB_CRM) {
            const team = await env.DB_CRM.prepare(`
              SELECT name FROM SupplierObj WHERE _id = ?
            `).bind(team_id).first();
            teamName = team ? team.name : null;
          }
        } catch (error) {
          console.error('Error getting team name:', error);
        }
        
        // 插入新師父到 CRM 數據庫（如果 env.DB_CRM 可用）
        try {
          if (env.DB_CRM) {
            await env.DB_CRM.prepare(`
              INSERT INTO object_50hj8__c (
                _id, name, abbreviation__c, phone_number__c, 
                field_D1087__c, field_D1087__c__r,
                is_deleted, life_status, create_time, last_modified_time
              ) VALUES (?, ?, ?, ?, ?, ?, 0, 'normal', datetime('now'), datetime('now'))
            `).bind(
              workerId,
              name,
              nickname || name.slice(-1),
              phone,
              team_id,
              teamName
            ).run();
          } else {
            throw new Error('DB_CRM binding not available');
          }
        } catch (error) {
          console.error('Database insert error:', error);
          throw new Error(`Failed to insert worker into database: ${error.message}`);
        }
        
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

    // Super Admin: Create new user
    if (path === '/api/v1/admin/users' && method === 'POST') {
      try {
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查 Super Admin 權限 (支持多個角色字段)
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!userRole || userRole !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Super Admin required'
          }), { status: 403, headers });
        }

        const body = await request.json();
        const { phone, name, email, global_role, password } = body;

        // 驗證必要欄位
        if (!phone || !name || !global_role) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: phone, name, global_role'
          }), { status: 400, headers });
        }

        // 標準化手機號碼
        const normalizedPhone = authUtils.normalizePhone(phone);
        if (!normalizedPhone) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid phone number format'
          }), { status: 400, headers });
        }

        // 檢查手機號碼是否已存在
        const existingUser = await env.DB_ENGINEERING.prepare(`
          SELECT id FROM users WHERE phone = ?
        `).bind(normalizedPhone).first();

        if (existingUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Phone number already exists'
          }), { status: 409, headers });
        }

        // 驗證角色
        const validRoles = ['super_admin', 'admin', 'user'];
        if (!validRoles.includes(global_role)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid global_role. Must be one of: ' + validRoles.join(', ')
          }), { status: 400, headers });
        }

        // 生成用戶ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // 創建用戶
        await env.DB_ENGINEERING.prepare(`
          INSERT INTO users (
            id, phone, name, email, global_role, user_status, 
            password_hash, login_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          userId,
          normalizedPhone,
          name,
          email || null,
          global_role,
          'active',
          password || null, // 簡化密碼處理，生產環境應該加密
          0
        ).run();

        return new Response(JSON.stringify({
          success: true,
          message: '用戶創建成功',
          data: {
            user_id: userId,
            phone: normalizedPhone,
            name: name,
            email: email,
            global_role: global_role,
            user_status: 'active'
          }
        }), { headers });

      } catch (error) {
        console.error('Error creating user:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create user',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // Super Admin: Get all users
    if (path === '/api/v1/admin/users' && method === 'GET') {
      try {
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查 Super Admin 權限 (支持多個角色字段)
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!userRole || userRole !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Super Admin required'
          }), { status: 403, headers });
        }

        // 獲取所有用戶及其專案角色
        const usersQuery = await env.DB_ENGINEERING.prepare(`
          SELECT 
            u.id as user_id,
            u.phone,
            u.name,
            u.email,
            u.global_role as role,
            u.user_status,
            u.last_login,
            u.login_count,
            u.created_at,
            u.updated_at
          FROM users u
          ORDER BY u.created_at DESC
        `).all();

        const users = usersQuery.results || [];

        // 為每個用戶獲取專案參與資訊
        for (let user of users) {
          try {
            const projectsQuery = await env.DB_ENGINEERING.prepare(`
              SELECT 
                pu.project_id,
                pu.user_type as user_role,
                pu.team_name,
                pu.role as team_role,
                pu.added_at as joined_at,
                p.name as project_name,
                p.status as project_status
              FROM project_users pu
              LEFT JOIN projects p ON pu.project_id = p.id
              WHERE pu.user_id = ?
              ORDER BY pu.added_at DESC
            `).bind(user.user_id).all();

            user.projects = projectsQuery.results || [];
            user.project_count = user.projects.length;
          } catch (error) {
            console.error('Error loading user projects:', error);
            user.projects = [];
            user.project_count = 0;
          }
        }

        // 前端期望直接的數組格式，而不是包裝在users字段中
        return new Response(JSON.stringify(users), { headers });

      } catch (error) {
        console.error('Error getting all users:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get users',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // Super Admin: Get all projects
    if (path === '/api/v1/admin/projects' && method === 'GET') {
      try {
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查 Super Admin 權限 (支持多個角色字段)
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!userRole || userRole !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Super Admin required'
          }), { status: 403, headers });
        }

        // 獲取所有專案及其用戶統計
        const projectsQuery = await env.DB_ENGINEERING.prepare(`
          SELECT 
            p.id as project_id,
            p.name,
            p.opportunity_id as company,
            p.status as project_status,
            '' as start_date,
            '' as end_date,
            p.created_at,
            p.updated_at,
            COUNT(pu.user_id) as user_count
          FROM projects p
          LEFT JOIN project_users pu ON p.id = pu.project_id
          GROUP BY p.id, p.name, p.opportunity_id, p.status, p.created_at, p.updated_at
          ORDER BY p.created_at DESC
        `).all();

        const projects = projectsQuery.results || [];

        return new Response(JSON.stringify({
          success: true,
          projects: projects,
          total: projects.length
        }), { headers });

      } catch (error) {
        console.error('Error getting all projects:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get projects',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // Super Admin: Get user's project roles
    if (path.match(/^\/api\/v1\/admin\/users\/[^\/]+\/projects$/) && method === 'GET') {
      try {
        const userId = path.split('/')[5];

        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查 Super Admin 權限 (支持多個角色字段)
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!userRole || userRole !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Super Admin required'
          }), { status: 403, headers });
        }

        // 獲取用戶的所有專案角色
        const projectsQuery = await env.DB_ENGINEERING.prepare(`
          SELECT 
            pu.project_id,
            pu.user_type as user_role,
            pu.team_name,
            pu.role as team_role,
            pu.added_at as joined_at,
            p.name as project_name,
            p.opportunity_id as project_company,
            p.status as project_status
          FROM project_users pu
          LEFT JOIN projects p ON pu.project_id = p.id
          WHERE pu.user_id = ?
          ORDER BY pu.added_at DESC
        `).bind(userId).all();

        const projects = projectsQuery.results || [];

        return new Response(JSON.stringify({
          success: true,
          projects: projects,
          user_id: userId
        }), { headers });

      } catch (error) {
        console.error('Error getting user projects:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get user projects',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // Super Admin: Get all project-user relationships
    if (path === '/api/v1/admin/project-users' && method === 'GET') {
      try {
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查管理員權限 (支持多個角色字段) - 允許管理員和超級管理員
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!['admin', 'super_admin'].includes(userRole)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Admin required'
          }), { status: 403, headers });
        }

        // 獲取所有專案用戶關聯
        const projectUsersQuery = await env.DB_ENGINEERING.prepare(`
          SELECT 
            pu.project_id,
            pu.user_id,
            pu.user_type,
            pu.team_name,
            pu.role as team_role,
            pu.added_at as joined_at,
            pu.added_by,
            u.name as user_name,
            u.phone as user_phone,
            u.global_role as user_global_role,
            p.name as project_name,
            p.opportunity_id as project_company,
            p.status as project_status
          FROM project_users pu
          LEFT JOIN users u ON pu.user_id = u.id
          LEFT JOIN projects p ON pu.project_id = p.id
          ORDER BY pu.added_at DESC
        `).all();

        const projectUsers = projectUsersQuery.results || [];

        // 前端期望直接的數組格式，而不是包裝在data字段中
        return new Response(JSON.stringify(projectUsers), { headers });

      } catch (error) {
        console.error('Error getting project users:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get project users',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // Super Admin: Create new project-user relationship
    if (path === '/api/v1/admin/project-users' && method === 'POST') {
      try {
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查 Super Admin 權限 (支持多個角色字段)
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!userRole || userRole !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Super Admin required'
          }), { status: 403, headers });
        }

        const body = await request.json();
        const { project_id, user_id, user_type, team_name, role } = body;

        // 驗證必要欄位
        if (!project_id || !user_id || !user_type) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: project_id, user_id, user_type'
          }), { status: 400, headers });
        }

        // 檢查專案是否存在
        const project = await env.DB_ENGINEERING.prepare(`
          SELECT id, name FROM projects WHERE id = ?
        `).bind(project_id).first();

        if (!project) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project not found'
          }), { status: 404, headers });
        }

        // 檢查用戶是否存在
        const user = await env.DB_ENGINEERING.prepare(`
          SELECT id, name, phone FROM users WHERE id = ?
        `).bind(user_id).first();

        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), { status: 404, headers });
        }

        // 檢查關聯是否已存在
        const existing = await env.DB_ENGINEERING.prepare(`
          SELECT id FROM project_users 
          WHERE project_id = ? AND user_id = ?
        `).bind(project_id, user_id).first();

        if (existing) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Project-user relationship already exists'
          }), { status: 409, headers });
        }

        // 創建專案用戶關聯
        await env.DB_ENGINEERING.prepare(`
          INSERT INTO project_users (
            project_id, user_id, user_type, team_id, team_name,
            name, phone, nickname, source_table, added_by, role, source_id,
            added_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          project_id,
          user_id,
          user_type,
          null, // team_id
          team_name || null,
          user.name,
          user.phone,
          null, // nickname
          'admin_created',
          authCheck.user.user_id || 'super_admin',
          role || 'member',
          null // source_id
        ).run();

        return new Response(JSON.stringify({
          success: true,
          message: '專案用戶關聯創建成功',
          data: {
            project_id,
            user_id,
            user_type,
            team_name,
            role: role || 'member'
          }
        }), { headers });

      } catch (error) {
        console.error('Error creating project user relationship:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create project user relationship',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // Super Admin: Update user status
    if (path.match(/^\/api\/v1\/admin\/users\/[^\/]+\/status$/) && method === 'PUT') {
      try {
        const userId = path.split('/')[5];
        const body = await request.json();
        const { status } = body;

        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        // 檢查 Super Admin 權限 (支持多個角色字段)
        const userRole = authCheck.user.role || authCheck.user.global_role || authCheck.user.user_type;
        if (!userRole || userRole !== 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Insufficient permissions - Super Admin required'
          }), { status: 403, headers });
        }

        // 驗證狀態值
        if (!['active', 'pending', 'suspended'].includes(status)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid status value'
          }), { status: 400, headers });
        }

        // 檢查用戶是否存在且不是 super_admin
        const user = await env.DB_ENGINEERING.prepare(`
          SELECT id as user_id, global_role as role FROM users WHERE id = ?
        `).bind(userId).first();

        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), { status: 404, headers });
        }

        if (user.role === 'super_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cannot modify Super Admin status'
          }), { status: 403, headers });
        }

        // 更新用戶狀態
        await env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET user_status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(status, userId).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'User status updated successfully',
          user_id: userId,
          new_status: status
        }), { headers });

      } catch (error) {
        console.error('Error updating user status:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update user status',
          message: error.message
        }), { status: 500, headers });
      }
    }

    // 檔案上傳 API
    if (path === '/api/v1/files/upload' && method === 'POST') {
      try {
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const fileService = new FileService(env);
        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');
        const siteId = url.searchParams.get('siteId');
        const type = url.searchParams.get('type');

        // 驗證必要參數
        if (!projectId || !siteId || !type) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required parameters: projectId, siteId, type'
          }), { status: 400, headers });
        }

        // 上傳檔案
        const metadata = {
          projectId,
          siteId,
          type, // 'before', 'after', 'floorPlan'
          userId: authCheck.user.user_id
        };

        const result = await fileService.uploadConstructionPhoto(request, metadata);

        return new Response(JSON.stringify({
          success: true,
          data: result
        }), { headers });
      } catch (error) {
        console.error('[File Upload Error]:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'File upload failed'
        }), { status: 500, headers });
      }
    }

    // 檔案獲取 API
    if (path.startsWith('/api/v1/files/') && method === 'GET') {
      try {
        const fileService = new FileService(env);
        const pathParts = path.split('/');
        const fileId = pathParts[pathParts.length - 1];

        if (!fileId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'File ID is required'
          }), { status: 400, headers });
        }

        // 對於檔案訪問，我們需要直接從 R2 獲取檔案
        // 這裡需要實現一個通過 fileId 查找實際檔案路徑的方式
        // 暫時先返回錯誤，因為需要實現檔案 ID 到路徑的映射
        return new Response(JSON.stringify({
          success: false,
          error: 'File access not implemented yet'
        }), { status: 501, headers });
      } catch (error) {
        console.error('[File Access Error]:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'File access failed'
        }), { status: 500, headers });
      }
    }

    // 案場更新 PATCH 路由
    if (path.match(/^\/rest\/object_8W9cb__c\/[^\/]+$/) && method === 'PATCH') {
      try {
        const siteId = path.split('/').pop();
        
        // 檢查認證
        const authCheck = await checkAuth(request);
        if (!authCheck.authenticated) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), { status: 401, headers });
        }

        const body = await request.json();
        console.log('[PATCH Site] Received data:', body);
        console.log('[PATCH Site] Site ID:', siteId);

        // 先更新 D1 資料庫 - 調用外部 D1 REST API
        const d1Response = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c/${siteId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer fx-crm-api-secret-2025',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!d1Response.ok) {
          const d1Error = await d1Response.text();
          console.error('[PATCH Site] D1 update failed:', d1Error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to update site in database'
          }), { status: 500, headers });
        }

        const d1Result = await d1Response.json();
        console.log('[PATCH Site] D1 update successful:', d1Result);

        // 異步同步到 CRM (不阻塞主流程)
        try {
          const fxCrmSync = new FxCrmSyncService(env);
          
          // 準備 CRM 更新資料，根據 CSV 檔案的欄位映射
          const crmUpdateData = {};
          
          // 基本欄位映射
          if (body.construction_completed__c !== undefined) {
            crmUpdateData.construction_completed__c = body.construction_completed__c;
          }
          if (body.field_23pFq__c !== undefined) {
            crmUpdateData.field_23pFq__c = body.field_23pFq__c; // 施工日期
          }
          if (body.field_u1wpv__c !== undefined) {
            crmUpdateData.field_u1wpv__c = body.field_u1wpv__c; // 工班師父
          }
          if (body.field_B2gh1__c !== undefined) {
            crmUpdateData.field_B2gh1__c = body.field_B2gh1__c; // 舖設坪數
          }
          if (body.work_shift_completion_note__c !== undefined) {
            crmUpdateData.work_shift_completion_note__c = body.work_shift_completion_note__c; // 工班施工完備註
          }
          if (body.field_3Fqof__c !== undefined) {
            crmUpdateData.field_3Fqof__c = body.field_3Fqof__c; // 完工照片
          }
          if (body.construction_difficulty_ph__c !== undefined) {
            crmUpdateData.construction_difficulty_ph__c = body.construction_difficulty_ph__c; // 工地狀況照片(施工後)
          }
          if (body.field_V3d91__c !== undefined) {
            crmUpdateData.field_V3d91__c = body.field_V3d91__c; // 施工前照片
          }
          if (body.field_z9H6O__c !== undefined) {
            crmUpdateData.field_z9H6O__c = body.field_z9H6O__c; // 階段
          }
          if (body.field_23Z5i__c !== undefined) {
            crmUpdateData.field_23Z5i__c = body.field_23Z5i__c; // 標籤
          }
          if (body.field_sF6fn__c !== undefined) {
            crmUpdateData.field_sF6fn__c = body.field_sF6fn__c; // 施工前備註
          }

          console.log('[PATCH Site] Syncing to CRM with data:', crmUpdateData);
          
          // 異步執行 CRM 同步（不等待結果）
          ctx.waitUntil(
            fxCrmSync.updateSite(siteId, crmUpdateData)
              .then(result => {
                console.log('[PATCH Site] CRM sync successful:', result);
              })
              .catch(error => {
                console.error('[PATCH Site] CRM sync failed:', error);
              })
          );
          
        } catch (crmError) {
          console.error('[PATCH Site] CRM sync setup failed:', crmError);
          // CRM 同步失敗不影響主流程
        }

        // 立即回應 D1 更新成功
        return new Response(JSON.stringify({
          success: true,
          data: d1Result.data || d1Result,
          message: 'Site updated successfully'
        }), { headers });

      } catch (error) {
        console.error('[PATCH Site] Error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update site',
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