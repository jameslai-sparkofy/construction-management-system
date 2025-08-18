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
               is_active, user_status, failed_login_count, locked_until
        FROM users 
        WHERE phone = ? AND is_active = 1
      `).bind(normalizedPhone).first();

      if (!user) {
        await this.logAudit(null, 'login_attempt', 'auth', null, {
          phone: normalizedPhone,
          result: 'user_not_found'
        });
        return { success: false, error: '用戶不存在或已停用' };
      }

      // 檢查帳號鎖定
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { success: false, error: '帳號已被鎖定，請稍後再試' };
      }

      // 檢查用戶狀態
      if (user.user_status === 'suspended') {
        return { success: false, error: '帳號已暫停使用' };
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
          error: shouldLock ? '密碼錯誤次數過多，帳號已鎖定30分鐘' : '密碼錯誤' 
        };
      }

      // 生成 JWT Token
      const tokenPayload = {
        user_id: user.id,
        phone: user.phone,
        role: user.global_role,
        name: user.name
      };

      const token = await this.jwt.generateToken(tokenPayload);

      // 生成 session ID
      const sessionId = 'sess_' + crypto.randomUUID();

      // 儲存 session
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

      // 更新用戶登入資訊
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET last_login = ?, 
            login_count = login_count + 1,
            failed_login_count = 0,
            locked_until = NULL,
            session_token = ?,
            user_status = CASE 
              WHEN user_status = 'pending' THEN 'active'
              ELSE user_status 
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
  async verifyToken(token) {
    try {
      if (!token) {
        return { valid: false, error: 'Token not provided' };
      }

      // 移除 Bearer 前綴
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      // 驗證 JWT
      const payload = await this.jwt.verifyToken(token);

      // 查詢用戶是否還有效
      const user = await this.env.DB_ENGINEERING.prepare(`
        SELECT id, phone, name, email, global_role, is_active, user_status
        FROM users 
        WHERE id = ? AND is_active = 1 AND user_status IN ('active', 'pending')
      `).bind(payload.user_id).first();

      if (!user) {
        return { valid: false, error: 'User not found or inactive' };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.global_role,
          user_type: user.global_role
        }
      };

    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false, error: error.message };
    }
  }

  // 登出
  async logout(token) {
    try {
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      const payload = await this.jwt.verifyToken(token);
      
      // 停用 session
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE user_sessions 
        SET is_active = 0 
        WHERE token = ?
      `).bind(token).run();

      // 清除用戶的 session token
      await this.env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET session_token = NULL 
        WHERE id = ?
      `).bind(payload.user_id).run();

      // 記錄登出日誌
      await this.logAudit(payload.user_id, 'logout', 'auth', null, {
        token_revoked: true
      });

      return { success: true };

    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
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