/**
 * 工程管理系統 API - Simplified Version
 * 使用單一 project_users 表的簡化設計
 */

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
          return new Response(JSON.stringify(result), { headers });
        } else {
          return new Response(JSON.stringify(result), { 
            status: 401, 
            headers 
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
        return new Response(JSON.stringify(result), { headers });
      } catch (error) {
        console.error('Logout API error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Logout failed'
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
        
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers
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
    
    // Default 404
    return new Response(JSON.stringify({
      success: false,
      error: 'Endpoint not found',
      path: path,
      method: method
    }), { status: 404, headers });
  }
};