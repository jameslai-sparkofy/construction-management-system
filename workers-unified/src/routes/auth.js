/**
 * 統一認證路由
 * 整合 Supabase 認證與緊急登入
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { createResponse, createErrorResponse, createSuccessResponse } from '../utils/response.js';

const auth = new Hono();

// ========================================
// Token 驗證
// ========================================

auth.get('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(c, 'No valid token provided', 401);
    }

    const token = authHeader.substring(7);

    // 檢查緊急登入 token
    if (c.env.ENABLE_EMERGENCY_LOGIN === 'true' && token === c.env.DEV_TOKEN) {
      return createSuccessResponse(c, {
        user: {
          id: 'emergency-admin',
          email: 'admin@emergency.local',
          role: 'super_admin',
          is_emergency: true,
          is_super_admin: true
        },
        token_type: 'emergency'
      }, 'Emergency access granted');
    }

    // Supabase Token 驗證
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return createErrorResponse(c, 'Invalid or expired token', 401);
    }

    // 從本地資料庫獲取用戶詳情
    const userDetails = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          *,
          CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END as is_super_admin
        FROM users 
        WHERE supabase_id = ? OR email = ?
      `)
      .bind(user.id, user.email)
      .first();

    return createSuccessResponse(c, {
      user: {
        ...user,
        ...userDetails,
        is_super_admin: userDetails?.is_super_admin === 1
      },
      token_type: 'supabase'
    }, 'Token is valid');

  } catch (error) {
    console.error('Token verification error:', error);
    return createErrorResponse(c, 'Token verification failed', 500);
  }
});

// ========================================
// 緊急登入 (僅開發環境)
// ========================================

auth.post('/emergency', async (c) => {
  if (c.env.ENABLE_EMERGENCY_LOGIN !== 'true') {
    return createErrorResponse(c, 'Emergency login is disabled', 403);
  }

  try {
    const { phone, code } = await c.req.json();
    
    if (!phone || !code) {
      return createErrorResponse(c, 'Phone and code are required', 400);
    }

    // 驗證緊急登入憑證
    if (phone === c.env.EMERGENCY_ADMIN_PHONE && 
        (code === c.env.EMERGENCY_ADMIN_CODE || c.env.DEV_TOKEN)) {
      
      return createSuccessResponse(c, {
        token: c.env.DEV_TOKEN || 'dev-emergency-token',
        user: {
          id: 'emergency-admin',
          email: 'admin@emergency.local',
          name: '緊急管理員',
          role: 'super_admin',
          is_emergency: true,
          is_super_admin: true
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小時後過期
      }, 'Emergency access granted');
    }

    return createErrorResponse(c, 'Invalid emergency credentials', 401);

  } catch (error) {
    console.error('Emergency login error:', error);
    return createErrorResponse(c, 'Emergency login failed', 500);
  }
});

// ========================================
// 用戶資訊查詢
// ========================================

auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(c, 'Authorization required', 401);
    }

    const token = authHeader.substring(7);

    // 緊急登入用戶
    if (c.env.ENABLE_EMERGENCY_LOGIN === 'true' && token === c.env.DEV_TOKEN) {
      return createSuccessResponse(c, {
        id: 'emergency-admin',
        email: 'admin@emergency.local',
        name: '緊急管理員',
        role: 'super_admin',
        is_emergency: true,
        is_super_admin: true,
        created_at: new Date().toISOString()
      });
    }

    // Supabase 用戶
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return createErrorResponse(c, 'Invalid token', 401);
    }

    // 獲取本地用戶詳情
    const localUser = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          *,
          CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END as is_super_admin
        FROM users 
        WHERE supabase_id = ? OR email = ?
      `)
      .bind(user.id, user.email)
      .first();

    if (!localUser) {
      // 自動創建本地用戶記錄
      await c.env.DB_ENGINEERING
        .prepare(`
          INSERT OR IGNORE INTO users (
            supabase_id, email, name, role, created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `)
        .bind(
          user.id, 
          user.email, 
          user.user_metadata?.name || user.email.split('@')[0], 
          'user'
        )
        .run();

      return createSuccessResponse(c, {
        ...user,
        name: user.user_metadata?.name || user.email.split('@')[0],
        role: 'user',
        is_super_admin: false
      });
    }

    return createSuccessResponse(c, {
      ...user,
      ...localUser,
      is_super_admin: localUser.is_super_admin === 1
    });

  } catch (error) {
    console.error('Get user info error:', error);
    return createErrorResponse(c, 'Failed to get user info', 500);
  }
});

// ========================================
// 登出 (清理相關 session)
// ========================================

auth.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // 清理 KV 中的 session 資料 (如果有的話)
      try {
        await c.env.SESSIONS.delete(token);
      } catch (e) {
        // 忽略 KV 錯誤
      }
    }

    return createSuccessResponse(c, null, 'Logout successful');

  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse(c, 'Logout failed', 500);
  }
});

// ========================================
// 系統狀態檢查
// ========================================

auth.get('/status', (c) => {
  return createSuccessResponse(c, {
    environment: c.env.ENVIRONMENT || 'development',
    emergency_login_enabled: c.env.ENABLE_EMERGENCY_LOGIN === 'true',
    supabase_configured: !!(c.env.SUPABASE_URL && c.env.SUPABASE_ANON_KEY),
    timestamp: new Date().toISOString()
  });
});

export default auth;