/**
 * 統一認證中間件
 * 整合 Supabase JWT 認證與緊急登入功能
 */

import { createClient } from '@supabase/supabase-js';
import { createErrorResponse } from '../utils/response.js';

export async function authMiddleware(c, next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      return createErrorResponse(c, 'Authorization header required', 401);
    }

    // 檢查是否為 Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return createErrorResponse(c, 'Invalid authorization format. Use Bearer <token>', 401);
    }

    const token = authHeader.substring(7);

    // 檢查緊急登入 token (僅開發環境)
    if (c.env.ENABLE_EMERGENCY_LOGIN === 'true' && token === c.env.DEV_TOKEN) {
      c.set('user', {
        id: 'emergency-admin',
        email: 'admin@emergency.local',
        role: 'super_admin',
        is_emergency: true
      });
      return next();
    }

    // Supabase JWT 驗證
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return createErrorResponse(c, 'Invalid or expired token', 401);
    }

    // 從工程管理資料庫獲取用戶詳細資訊
    const userDetails = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          u.*,
          COALESCE(u.role, 'user') as role,
          CASE 
            WHEN u.role = 'super_admin' THEN 1
            ELSE 0
          END as is_super_admin
        FROM users u 
        WHERE u.supabase_id = ? OR u.email = ?
      `)
      .bind(user.id, user.email)
      .first();

    // 如果用戶在 Supabase 中但不在本地資料庫，創建基本記錄
    if (!userDetails) {
      await c.env.DB_ENGINEERING
        .prepare(`
          INSERT OR IGNORE INTO users (
            supabase_id, email, name, role, created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `)
        .bind(user.id, user.email, user.user_metadata?.name || user.email, 'user')
        .run();

      // 重新查詢用戶資訊
      const newUserDetails = await c.env.DB_ENGINEERING
        .prepare(`SELECT * FROM users WHERE supabase_id = ?`)
        .bind(user.id)
        .first();

      c.set('user', {
        ...user,
        ...newUserDetails,
        role: 'user',
        is_super_admin: false
      });
    } else {
      c.set('user', {
        ...user,
        ...userDetails,
        is_super_admin: userDetails.is_super_admin === 1
      });
    }

    return next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return createErrorResponse(c, 'Authentication error', 500);
  }
}

// 權限檢查輔助函數
export function requireRole(roles) {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      return createErrorResponse(c, 'User not authenticated', 401);
    }

    const userRole = user.role || 'user';
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!requiredRoles.includes(userRole) && !user.is_super_admin) {
      return createErrorResponse(c, 
        `Access denied. Required role: ${requiredRoles.join(' or ')}`, 
        403
      );
    }

    return next();
  };
}

export function requireSuperAdmin() {
  return requireRole(['super_admin']);
}

export function requireProjectAccess() {
  return async (c, next) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId') || c.req.param('id');
    
    if (!projectId) {
      return next(); // 如果沒有 projectId，繼續執行（可能是列表查詢）
    }

    // Super Admin 可以存取所有項目
    if (user.is_super_admin) {
      return next();
    }

    // 檢查用戶是否有該項目的存取權限
    const hasAccess = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 1 FROM project_users 
        WHERE project_id = ? AND user_id = ?
      `)
      .bind(projectId, user.id)
      .first();

    if (!hasAccess) {
      return createErrorResponse(c, 'Access denied to this project', 403);
    }

    return next();
  };
}