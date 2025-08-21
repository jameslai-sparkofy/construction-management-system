/**
 * 認證服務模組
 * 提供 JWT Token 生成、驗證和用戶認證功能
 */

// 簡化的 JWT 實作 (適用於 Cloudflare Workers)
class SimpleJWT {
  constructor(secret) {
    this.secret = secret || 'default-jwt-secret-change-in-production';
  }

  // Base64 URL encode
  base64UrlEncode(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Base64 URL decode
  base64UrlDecode(str) {
    // 添加 padding
    str += '='.repeat(4 - str.length % 4);
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }

  // 生成 HMAC SHA256 簽名 (簡化版)
  async sign(data) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );
    
    return this.base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );
  }

  // 生成 JWT Token
  async generateToken(payload, expiresInHours = 24 * 30) { // 30天
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + (expiresInHours * 3600)
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = await this.sign(data);
    
    return `${data}.${signature}`;
  }

  // 驗證 JWT Token
  async verifyToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const data = `${encodedHeader}.${encodedPayload}`;
      
      // 驗證簽名
      const expectedSignature = await this.sign(data);
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      // 解析 payload
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
      
      // 檢查過期
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
}

// 認證服務類
class AuthService {
  constructor(env) {
    this.env = env;
    this.jwt = new SimpleJWT(env.JWT_SECRET);
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

  // 登入驗證 (支援舊格式)
  async login(credentials) {
    try {
      // 支援新格式 {phone, password} 或舊格式 (phone, password)
      let phone, password;
      if (typeof credentials === 'object' && credentials.phone) {
        phone = credentials.phone;
        password = credentials.password;
      } else {
        phone = arguments[0];
        password = arguments[1];
      }

      const normalizedPhone = this.normalizePhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: '手機號碼格式不正確' };
      }

      // 查詢用戶
      const user = await this.env.DB_ENGINEERING.prepare(`
        SELECT id, phone, password_suffix, name, email, global_role, 
               is_active, user_status, failed_login_count, locked_until
        FROM users 
        WHERE phone = ? AND is_active = 1
      `).bind(normalizedPhone).first();

      if (!user) {
        await this.logAudit(null, 'login_attempt', 'auth', null, {
          phone: normalizedPhone,
          result: 'user_not_found'
        });
        return { success: false, error: '手機號碼或密碼錯誤' };
      }

      // 檢查帳號鎖定
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { success: false, error: '帳號已被鎖定，請稍後再試' };
      }

      // 檢查用戶狀態
      if (user.user_status === 'suspended') {
        return { success: false, error: '帳號已暫停使用' };
      }

      if (user.is_active === false || user.is_active === 0) {
        return { success: false, error: '帳號已被停用' };
      }

      // 驗證密碼
      if (user.password_suffix !== password) {
        // 增加失敗次數
        const newFailCount = (user.failed_login_count || 0) + 1;
        const shouldLock = newFailCount >= 5;
        
        await this.env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET failed_login_count = ?, 
              locked_until = ?
          WHERE id = ?
        `).bind(
          newFailCount,
          shouldLock ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null, // 鎖定30分鐘
          user.id
        ).run();

        await this.logAudit(user.id, 'login_failed', 'auth', null, {
          phone: normalizedPhone,
          failed_count: newFailCount,
          locked: shouldLock
        });

        return { 
          success: false, 
          error: shouldLock ? '密碼錯誤次數過多，帳號已鎖定30分鐘' : '手機號碼或密碼錯誤' 
        };
      }

      // 生成 JWT Token
      const tokenPayload = {
        userId: user.id, // 測試需要的格式
        user_id: user.id,
        phone: user.phone,
        role: user.global_role,
        name: user.name
      };

      const token = await this.jwt.generateToken(tokenPayload);

      // 生成 session ID
      const sessionId = 'sess_' + crypto.randomUUID();

      // 儲存 session (如果表存在)
      try {
        await this.env.DB_ENGINEERING.prepare(`
          INSERT INTO user_sessions (id, user_id, token, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          sessionId,
          user.id,
          token,
          new Date().toISOString(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30天
        ).run();
      } catch (e) {
        // 如果表不存在，可以忽略
        console.log('user_sessions table not available, skipping session storage');
      }

      // 更新用戶登入資訊
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET last_login = ?, 
            login_count = COALESCE(login_count, 0) + 1,
            failed_login_count = 0,
            locked_until = NULL,
            session_token = ?,
            user_status = CASE 
              WHEN user_status = 'pending' THEN 'active'
              ELSE COALESCE(user_status, 'active')
            END
        WHERE id = ?
      `).bind(
        new Date().toISOString(),
        token,
        user.id
      ).run();

      // 記錄登入日誌
      await this.logAudit(user.id, 'login_success', 'auth', sessionId, {
        phone: normalizedPhone,
        session_id: sessionId
      });

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.global_role,
            user_type: user.global_role, // 相容性
            is_first_login: user.user_status === 'pending'
          },
          token: token,
          session_id: sessionId,
          expires_in: 30 * 24 * 3600 // 30天 (秒)
        }
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '登入系統錯誤' };
    }
  }

  // 驗證 Token
  async validateToken(token) {
    try {
      if (!token) {
        return { valid: false, error: 'No token provided' };
      }

      // 移除 Bearer 前綴
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      // 驗證 JWT
      const payload = await this.jwt.verifyToken(token);

      // 檢查過期
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { valid: false, error: 'Token expired' };
      }

      // 查詢 session（如果有的話）
      let sessionValid = true;
      try {
        const session = await this.env.SESSION_STORE?.get(`session:${payload.userId}`);
        if (!session) {
          sessionValid = false;
        }
      } catch (e) {
        // SESSION_STORE 可能不存在，繼續處理
      }

      if (!sessionValid) {
        return { valid: false, error: 'Session not found' };
      }

      return {
        valid: true,
        userId: payload.userId,
        role: payload.role,
        user: {
          id: payload.userId,
          name: payload.name,
          phone: payload.phone,
          role: payload.role
        }
      };

    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false, error: error.message };
    }
  }

  // 驗證 JWT (別名)
  async verifyJWT(token) {
    return await this.jwt.verifyToken(token);
  }

  // 登出
  async logout(userId) {
    try {
      // 清除 session
      try {
        await this.env.SESSION_STORE?.delete(`session:${userId}`);
      } catch (e) {
        // 忽略 SESSION_STORE 錯誤
      }

      // 停用資料庫 sessions
      try {
        await this.env.DB_ENGINEERING.prepare(`
          UPDATE user_sessions 
          SET is_active = 0 
          WHERE user_id = ?
        `).bind(userId).run();
      } catch (e) {
        // 表可能不存在，忽略
      }

      // 清除用戶的 session token
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET session_token = NULL 
        WHERE id = ?
      `).bind(userId).run();

      // 記錄登出日誌
      await this.logAudit(userId, 'logout', 'auth', null, {
        token_revoked: true
      });

      return { success: true };

    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  // 更改密碼
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // 查詢現有密碼
      const user = await this.env.DB_ENGINEERING.prepare(`
        SELECT password_suffix FROM users WHERE id = ?
      `).bind(userId).first();

      if (!user) {
        return { success: false, error: '使用者不存在' };
      }

      if (user.password_suffix !== oldPassword) {
        return { success: false, error: '舊密碼錯誤' };
      }

      // 更新密碼
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE users SET password_suffix = ? WHERE id = ?
      `).bind(newPassword, userId).run();

      return { success: true };

    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: '更改密碼失敗' };
    }
  }

  // 取得用戶資料
  async getUserById(userId) {
    try {
      const user = await this.env.DB_ENGINEERING.prepare(`
        SELECT id, phone, name, email, global_role, is_active, user_status
        FROM users 
        WHERE id = ?
      `).bind(userId).first();

      if (!user) {
        return { success: false, error: '使用者不存在' };
      }

      // 不回傳密碼
      const { password_suffix, ...userData } = user;

      return {
        success: true,
        data: userData
      };

    } catch (error) {
      console.error('Get user error:', error);
      return { success: false, error: '取得使用者資料失敗' };
    }
  }

  // 認證中介軟體
  async requireAuth(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return { authenticated: false, error: 'No token provided' };
    }

    const token = authHeader.replace('Bearer ', '');
    const validation = await this.validateToken(token);

    if (!validation.valid) {
      return { authenticated: false, error: validation.error };
    }

    return {
      authenticated: true,
      userId: validation.userId,
      role: validation.role,
      user: validation.user
    };
  }

  // 記錄審計日誌
  async logAudit(userId, action, targetType, targetId, changes) {
    try {
      await this.env.DB_ENGINEERING.prepare(`
        INSERT INTO audit_logs (user_id, action, target_type, target_id, changes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        action,
        targetType,
        targetId,
        JSON.stringify(changes),
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }

  // 獲取用戶在專案中的角色
  async getUserProjectRole(userId, projectId) {
    try {
      const projectRole = await this.env.DB_ENGINEERING.prepare(`
        SELECT user_type, role, team_id, team_name
        FROM project_users 
        WHERE project_id = ? AND user_id = ?
      `).bind(projectId, userId).first();

      return projectRole;
    } catch (error) {
      console.error('Get user project role error:', error);
      return null;
    }
  }
}

// 導出類別
export { AuthService };