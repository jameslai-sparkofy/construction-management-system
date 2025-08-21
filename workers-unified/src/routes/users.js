/**
 * 統一用戶管理路由
 */

import { Hono } from 'hono';
import { createResponse, createErrorResponse, createSuccessResponse } from '../utils/response.js';
import { requireRole, requireSuperAdmin } from '../middleware/auth.js';

const users = new Hono();

// ========================================
// 獲取當前用戶資訊
// ========================================

users.get('/me', async (c) => {
  try {
    const user = c.get('user');
    
    // 獲取用戶詳細資訊
    const userDetails = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          u.*,
          COUNT(DISTINCT pu.project_id) as project_count,
          CASE WHEN u.role = 'super_admin' THEN 1 ELSE 0 END as is_super_admin
        FROM users u
        LEFT JOIN project_users pu ON u.id = pu.user_id
        WHERE u.id = ? OR u.supabase_id = ?
        GROUP BY u.id
      `)
      .bind(user.id, user.id)
      .first();

    return createSuccessResponse(c, { user: userDetails || user });

  } catch (error) {
    console.error('Get current user error:', error);
    return createErrorResponse(c, 'Failed to get user info', 500);
  }
});

// ========================================
// 獲取用戶列表 (需要管理員權限)
// ========================================

users.get('/', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    const url = new URL(c.req.url);
    const filters = {
      role: url.searchParams.get('role'),
      search: url.searchParams.get('search'),
      limit: parseInt(url.searchParams.get('limit')) || 20,
      offset: parseInt(url.searchParams.get('offset')) || 0
    };

    let query = `
      SELECT 
        u.*,
        COUNT(DISTINCT pu.project_id) as project_count,
        CASE WHEN u.role = 'super_admin' THEN 1 ELSE 0 END as is_super_admin
      FROM users u
      LEFT JOIN project_users pu ON u.id = pu.user_id
    `;
    
    const conditions = [];
    const params = [];
    
    if (filters.role) {
      conditions.push('u.role = ?');
      params.push(filters.role);
    }
    
    if (filters.search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(filters.limit, filters.offset);

    const usersResult = await c.env.DB_ENGINEERING
      .prepare(query)
      .bind(...params)
      .all();

    return createSuccessResponse(c, {
      users: usersResult.results || [],
      pagination: {
        limit: filters.limit,
        offset: filters.offset
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    return createErrorResponse(c, 'Failed to get users', 500);
  }
});

// ========================================
// 獲取單一用戶詳情
// ========================================

users.get('/:id', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    const userId = c.req.param('id');
    
    const user = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          u.*,
          CASE WHEN u.role = 'super_admin' THEN 1 ELSE 0 END as is_super_admin
        FROM users u
        WHERE u.id = ?
      `)
      .bind(userId)
      .first();
    
    if (!user) {
      return createErrorResponse(c, 'User not found', 404);
    }

    // 獲取用戶參與的專案
    const projects = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          p.id,
          p.name,
          pu.role as project_role,
          pu.joined_at
        FROM project_users pu
        JOIN projects p ON pu.project_id = p.id
        WHERE pu.user_id = ?
        ORDER BY pu.joined_at DESC
      `)
      .bind(userId)
      .all();

    return createSuccessResponse(c, {
      user: {
        ...user,
        projects: projects.results || []
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return createErrorResponse(c, 'Failed to get user', 500);
  }
});

// ========================================
// 更新用戶資訊
// ========================================

users.put('/me', async (c) => {
  try {
    const user = c.get('user');
    const data = await c.req.json();
    
    // 用戶可以更新的欄位
    const allowedFields = ['name', 'phone'];
    const updateFields = [];
    const params = [];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(data[field]);
      }
    });
    
    if (updateFields.length === 0) {
      return createErrorResponse(c, 'No valid fields to update', 400);
    }
    
    updateFields.push('updated_at = datetime("now")');
    params.push(user.id);
    
    await c.env.DB_ENGINEERING
      .prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // 獲取更新後的用戶資訊
    const updatedUser = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    return createSuccessResponse(c, { user: updatedUser }, 'User updated successfully');

  } catch (error) {
    console.error('Update user error:', error);
    return createErrorResponse(c, 'Failed to update user', 500);
  }
});

// ========================================
// 管理員更新用戶資訊
// ========================================

users.put('/:id', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    const userId = c.req.param('id');
    const currentUser = c.get('user');
    const data = await c.req.json();
    
    // 檢查用戶是否存在
    const targetUser = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();
    
    if (!targetUser) {
      return createErrorResponse(c, 'User not found', 404);
    }

    // 只有 Super Admin 可以修改其他 Super Admin
    if (targetUser.role === 'super_admin' && !currentUser.is_super_admin) {
      return createErrorResponse(c, 'Cannot modify super admin user', 403);
    }

    // 管理員可以更新的欄位
    const allowedFields = ['name', 'phone', 'role'];
    const updateFields = [];
    const params = [];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        // 只有 Super Admin 可以修改角色
        if (field === 'role' && !currentUser.is_super_admin) {
          return;
        }
        updateFields.push(`${field} = ?`);
        params.push(data[field]);
      }
    });
    
    if (updateFields.length === 0) {
      return createErrorResponse(c, 'No valid fields to update', 400);
    }
    
    updateFields.push('updated_at = datetime("now")');
    params.push(userId);
    
    await c.env.DB_ENGINEERING
      .prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // 獲取更新後的用戶資訊
    const updatedUser = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();

    return createSuccessResponse(c, { user: updatedUser }, 'User updated successfully');

  } catch (error) {
    console.error('Admin update user error:', error);
    return createErrorResponse(c, 'Failed to update user', 500);
  }
});

// ========================================
// 刪除用戶 (僅 Super Admin)
// ========================================

users.delete('/:id', requireSuperAdmin(), async (c) => {
  try {
    const userId = c.req.param('id');
    const currentUser = c.get('user');
    
    // 不能刪除自己
    if (userId === currentUser.id) {
      return createErrorResponse(c, 'Cannot delete yourself', 400);
    }

    // 檢查用戶是否存在
    const targetUser = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();
    
    if (!targetUser) {
      return createErrorResponse(c, 'User not found', 404);
    }

    // 刪除用戶相關資料
    await c.env.DB_ENGINEERING.batch([
      c.env.DB_ENGINEERING.prepare('DELETE FROM project_users WHERE user_id = ?').bind(userId),
      c.env.DB_ENGINEERING.prepare('DELETE FROM users WHERE id = ?').bind(userId)
    ]);

    return createSuccessResponse(c, null, 'User deleted successfully');

  } catch (error) {
    console.error('Delete user error:', error);
    return createErrorResponse(c, 'Failed to delete user', 500);
  }
});

// ========================================
// 獲取用戶統計
// ========================================

users.get('/stats/summary', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    // 總用戶數
    const totalResult = await c.env.DB_ENGINEERING
      .prepare('SELECT COUNT(*) as total FROM users')
      .first();

    // 按角色統計
    const roleResult = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          role,
          COUNT(*) as count 
        FROM users 
        GROUP BY role
      `)
      .all();

    // 最近註冊的用戶
    const recentResult = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          id,
          name,
          email,
          role,
          created_at
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `)
      .all();

    // 轉換角色統計為物件格式
    const byRole = {};
    (roleResult.results || []).forEach(row => {
      byRole[row.role || 'user'] = row.count;
    });

    return createSuccessResponse(c, {
      total: totalResult.total || 0,
      by_role: byRole,
      recent_registrations: recentResult.results || []
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    return createErrorResponse(c, 'Failed to get user statistics', 500);
  }
});

export default users;