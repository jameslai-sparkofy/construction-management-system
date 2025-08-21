/**
 * 統一專案管理路由
 * 整合原有的專案管理功能
 */

import { Hono } from 'hono';
import { createResponse, createErrorResponse, createSuccessResponse } from '../utils/response.js';
import { requireRole, requireProjectAccess } from '../middleware/auth.js';

const projects = new Hono();

// ========================================
// 專案列表
// ========================================

projects.get('/', async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);
    
    // 查詢參數
    const filters = {
      status: url.searchParams.get('status'),
      search: url.searchParams.get('search'),
      limit: parseInt(url.searchParams.get('limit')) || 20,
      offset: parseInt(url.searchParams.get('offset')) || 0,
      sortBy: url.searchParams.get('sortBy') || 'created_at',
      sortOrder: url.searchParams.get('sortOrder') || 'desc'
    };

    let query = `
      SELECT 
        p.*,
        u.name as creator_name,
        COUNT(DISTINCT pu.user_id) as member_count,
        COUNT(DISTINCT s.id) as site_count
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN project_users pu ON p.id = pu.project_id
      LEFT JOIN (
        SELECT field_1P96q__c as opportunity_id, COUNT(*) as count, id
        FROM object_8w9cb__c 
        GROUP BY field_1P96q__c
      ) s ON p.opportunity_id = s.opportunity_id
    `;
    
    const conditions = [];
    const params = [];
    
    // 權限過濾：非 Super Admin 只能看到有權限的專案
    if (!user.is_super_admin) {
      conditions.push(`
        (p.created_by = ? OR 
         EXISTS(SELECT 1 FROM project_users pu2 WHERE pu2.project_id = p.id AND pu2.user_id = ?))
      `);
      params.push(user.id, user.id);
    }
    
    // 狀態篩選
    if (filters.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
    
    // 搜尋篩選
    if (filters.search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` GROUP BY p.id ORDER BY p.${filters.sortBy} ${filters.sortOrder} LIMIT ? OFFSET ?`;
    params.push(filters.limit, filters.offset);

    const projects = await c.env.DB_ENGINEERING
      .prepare(query)
      .bind(...params)
      .all();

    return createSuccessResponse(c, {
      projects: projects.results || [],
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: projects.results?.length || 0
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    return createErrorResponse(c, 'Failed to get projects', 500);
  }
});

// ========================================
// 獲取單一專案
// ========================================

projects.get('/:id', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('id');
    const user = c.get('user');
    
    // 獲取專案基本資訊
    const project = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          p.*,
          u.name as creator_name,
          u.email as creator_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `)
      .bind(projectId)
      .first();
    
    if (!project) {
      return createErrorResponse(c, 'Project not found', 404);
    }

    // 獲取專案成員
    const members = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          u.id,
          u.name,
          u.email,
          pu.role,
          pu.joined_at
        FROM project_users pu
        JOIN users u ON pu.user_id = u.id
        WHERE pu.project_id = ?
        ORDER BY pu.joined_at
      `)
      .bind(projectId)
      .all();

    // 從 CRM 資料庫獲取相關案場
    let sites = [];
    if (project.opportunity_id) {
      try {
        const sitesResult = await c.env.DB_CRM
          .prepare(`
            SELECT * FROM object_8w9cb__c 
            WHERE field_1P96q__c = ? 
            ORDER BY field_2RKz7__c
          `)
          .bind(project.opportunity_id)
          .all();
        sites = sitesResult.results || [];
      } catch (error) {
        console.warn('Failed to load project sites:', error);
      }
    }

    return createSuccessResponse(c, {
      project: {
        ...project,
        members: members.results || [],
        sites: sites,
        site_count: sites.length
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    return createErrorResponse(c, 'Failed to get project', 500);
  }
});

// ========================================
// 創建專案
// ========================================

projects.post('/', requireRole(['admin', 'project_manager']), async (c) => {
  try {
    const user = c.get('user');
    const data = await c.req.json();
    
    // 驗證必要欄位
    if (!data.name || !data.description) {
      return createErrorResponse(c, 'Project name and description are required', 400);
    }

    // 生成專案 ID
    const projectId = crypto.randomUUID();

    // 插入專案
    await c.env.DB_ENGINEERING
      .prepare(`
        INSERT INTO projects (
          id, name, description, opportunity_id, status,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `)
      .bind(
        projectId,
        data.name,
        data.description,
        data.opportunity_id || null,
        data.status || 'planning',
        user.id
      )
      .run();

    // 自動添加創建者為專案管理員
    await c.env.DB_ENGINEERING
      .prepare(`
        INSERT INTO project_users (project_id, user_id, role, joined_at)
        VALUES (?, ?, 'admin', datetime('now'))
      `)
      .bind(projectId, user.id)
      .run();

    // 獲取創建的專案
    const newProject = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          p.*,
          u.name as creator_name
        FROM projects p
        JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `)
      .bind(projectId)
      .first();

    return createSuccessResponse(c, { project: newProject }, 'Project created successfully');

  } catch (error) {
    console.error('Create project error:', error);
    return createErrorResponse(c, 'Failed to create project', 500);
  }
});

// ========================================
// 更新專案
// ========================================

projects.put('/:id', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('id');
    const user = c.get('user');
    const data = await c.req.json();

    // 檢查專案是否存在
    const project = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first();
    
    if (!project) {
      return createErrorResponse(c, 'Project not found', 404);
    }

    // 檢查用戶是否有編輯權限
    if (!user.is_super_admin && project.created_by !== user.id) {
      const hasAdminRole = await c.env.DB_ENGINEERING
        .prepare(`
          SELECT 1 FROM project_users 
          WHERE project_id = ? AND user_id = ? AND role IN ('admin', 'project_manager')
        `)
        .bind(projectId, user.id)
        .first();
      
      if (!hasAdminRole) {
        return createErrorResponse(c, 'Insufficient permissions to edit this project', 403);
      }
    }

    // 構建更新語句
    const updateFields = [];
    const params = [];
    
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      params.push(data.name);
    }
    
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      params.push(data.description);
    }
    
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      params.push(data.status);
    }
    
    if (data.opportunity_id !== undefined) {
      updateFields.push('opportunity_id = ?');
      params.push(data.opportunity_id);
    }
    
    if (updateFields.length === 0) {
      return createErrorResponse(c, 'No valid fields to update', 400);
    }
    
    updateFields.push('updated_at = datetime("now")');
    params.push(projectId);
    
    await c.env.DB_ENGINEERING
      .prepare(`UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // 獲取更新後的專案
    const updatedProject = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          p.*,
          u.name as creator_name
        FROM projects p
        JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `)
      .bind(projectId)
      .first();

    return createSuccessResponse(c, { project: updatedProject }, 'Project updated successfully');

  } catch (error) {
    console.error('Update project error:', error);
    return createErrorResponse(c, 'Failed to update project', 500);
  }
});

// ========================================
// 刪除專案
// ========================================

projects.delete('/:id', requireRole(['admin', 'super_admin']), requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('id');
    const user = c.get('user');

    // 檢查專案是否存在
    const project = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first();
    
    if (!project) {
      return createErrorResponse(c, 'Project not found', 404);
    }

    // 只有 Super Admin 或專案創建者可以刪除
    if (!user.is_super_admin && project.created_by !== user.id) {
      return createErrorResponse(c, 'Only project creator or super admin can delete projects', 403);
    }

    // 刪除專案相關資料
    await c.env.DB_ENGINEERING.batch([
      c.env.DB_ENGINEERING.prepare('DELETE FROM project_users WHERE project_id = ?').bind(projectId),
      c.env.DB_ENGINEERING.prepare('DELETE FROM projects WHERE id = ?').bind(projectId)
    ]);

    return createSuccessResponse(c, null, 'Project deleted successfully');

  } catch (error) {
    console.error('Delete project error:', error);
    return createErrorResponse(c, 'Failed to delete project', 500);
  }
});

// ========================================
// 專案成員管理
// ========================================

// 獲取專案成員
projects.get('/:id/users', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('id');

    const members = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.role as system_role,
          pu.role as project_role,
          pu.joined_at
        FROM project_users pu
        JOIN users u ON pu.user_id = u.id
        WHERE pu.project_id = ?
        ORDER BY pu.joined_at
      `)
      .bind(projectId)
      .all();

    return createSuccessResponse(c, { members: members.results || [] });

  } catch (error) {
    console.error('Get project members error:', error);
    return createErrorResponse(c, 'Failed to get project members', 500);
  }
});

// 添加專案成員
projects.post('/:id/users', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('id');
    const user = c.get('user');
    const data = await c.req.json();

    if (!data.user_id || !data.role) {
      return createErrorResponse(c, 'User ID and role are required', 400);
    }

    // 檢查用戶是否存在
    const targetUser = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(data.user_id)
      .first();
    
    if (!targetUser) {
      return createErrorResponse(c, 'User not found', 404);
    }

    // 檢查是否已經是成員
    const existingMember = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM project_users WHERE project_id = ? AND user_id = ?')
      .bind(projectId, data.user_id)
      .first();
    
    if (existingMember) {
      return createErrorResponse(c, 'User is already a member of this project', 400);
    }

    // 添加成員
    await c.env.DB_ENGINEERING
      .prepare(`
        INSERT INTO project_users (project_id, user_id, role, joined_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
      .bind(projectId, data.user_id, data.role)
      .run();

    return createSuccessResponse(c, null, 'User added to project successfully');

  } catch (error) {
    console.error('Add project member error:', error);
    return createErrorResponse(c, 'Failed to add project member', 500);
  }
});

// 移除專案成員
projects.delete('/:id/users/:userId', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('id');
    const userId = c.req.param('userId');
    const currentUser = c.get('user');

    // 檢查是否為專案創建者（不能移除自己）
    const project = await c.env.DB_ENGINEERING
      .prepare('SELECT created_by FROM projects WHERE id = ?')
      .bind(projectId)
      .first();
    
    if (project && project.created_by === userId) {
      return createErrorResponse(c, 'Cannot remove project creator', 400);
    }

    // 移除成員
    const result = await c.env.DB_ENGINEERING
      .prepare('DELETE FROM project_users WHERE project_id = ? AND user_id = ?')
      .bind(projectId, userId)
      .run();

    if (result.changes === 0) {
      return createErrorResponse(c, 'User is not a member of this project', 404);
    }

    return createSuccessResponse(c, null, 'User removed from project successfully');

  } catch (error) {
    console.error('Remove project member error:', error);
    return createErrorResponse(c, 'Failed to remove project member', 500);
  }
});

export default projects;