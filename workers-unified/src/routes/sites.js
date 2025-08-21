/**
 * 統一案場管理路由
 * 整合 D1 數據庫直接存取，移除外部 REST API 依賴
 */

import { Hono } from 'hono';
import { createResponse, createErrorResponse, createSuccessResponse } from '../utils/response.js';
import { requireProjectAccess } from '../middleware/auth.js';

const sites = new Hono();

// ========================================
// 案場列表 (支援專案篩選)
// ========================================

sites.get('/', async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);
    
    // 查詢參數
    const filters = {
      project_id: url.searchParams.get('project_id'),
      opportunity_id: url.searchParams.get('opportunity_id'),
      status: url.searchParams.get('status'),
      search: url.searchParams.get('search'),
      limit: parseInt(url.searchParams.get('limit')) || 50,
      offset: parseInt(url.searchParams.get('offset')) || 0,
      sortBy: url.searchParams.get('sortBy') || 'field_2RKz7__c', // 案場名稱
      sortOrder: url.searchParams.get('sortOrder') || 'asc'
    };

    let query = `SELECT * FROM object_8w9cb__c`;
    const conditions = [];
    const params = [];
    
    // 機會篩選
    if (filters.opportunity_id) {
      conditions.push('field_1P96q__c = ?');
      params.push(filters.opportunity_id);
    }
    
    // 專案篩選（通過機會 ID）
    if (filters.project_id) {
      // 先獲取專案的 opportunity_id
      const project = await c.env.DB_ENGINEERING
        .prepare('SELECT opportunity_id FROM projects WHERE id = ?')
        .bind(filters.project_id)
        .first();
      
      if (project && project.opportunity_id) {
        conditions.push('field_1P96q__c = ?');
        params.push(project.opportunity_id);
      } else {
        // 如果專案沒有關聯的 opportunity_id，返回空結果
        return createSuccessResponse(c, {
          sites: [],
          pagination: {
            limit: filters.limit,
            offset: filters.offset,
            total: 0
          }
        });
      }
    }
    
    // 搜尋篩選
    if (filters.search) {
      conditions.push('(field_2RKz7__c LIKE ? OR field_2RLi8__c LIKE ? OR field_2RLmO__c LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 排序和分頁
    query += ` ORDER BY ${filters.sortBy} ${filters.sortOrder} LIMIT ? OFFSET ?`;
    params.push(filters.limit, filters.offset);

    const sitesResult = await c.env.DB_CRM
      .prepare(query)
      .bind(...params)
      .all();

    // 獲取總數（用於分頁）
    let countQuery = `SELECT COUNT(*) as total FROM object_8w9cb__c`;
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await c.env.DB_CRM
      .prepare(countQuery)
      .bind(...params.slice(0, -2)) // 移除 LIMIT 和 OFFSET 參數
      .first();

    return createSuccessResponse(c, {
      sites: sitesResult.results || [],
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: countResult.total || 0
      }
    });

  } catch (error) {
    console.error('Get sites error:', error);
    return createErrorResponse(c, 'Failed to get sites', 500);
  }
});

// ========================================
// 獲取單一案場詳細資訊
// ========================================

sites.get('/:id', async (c) => {
  try {
    const siteId = c.req.param('id');
    
    const site = await c.env.DB_CRM
      .prepare('SELECT * FROM object_8w9cb__c WHERE _id = ?')
      .bind(siteId)
      .first();
    
    if (!site) {
      return createErrorResponse(c, 'Site not found', 404);
    }

    // 獲取相關專案資訊（如果有）
    let project = null;
    if (site.field_1P96q__c) {
      project = await c.env.DB_ENGINEERING
        .prepare('SELECT * FROM projects WHERE opportunity_id = ?')
        .bind(site.field_1P96q__c)
        .first();
    }

    return createSuccessResponse(c, {
      site: {
        ...site,
        project: project
      }
    });

  } catch (error) {
    console.error('Get site error:', error);
    return createErrorResponse(c, 'Failed to get site', 500);
  }
});

// ========================================
// 更新案場資訊 (修復原有的 PATCH 問題)
// ========================================

sites.patch('/:id', async (c) => {
  try {
    const siteId = c.req.param('id');
    const user = c.get('user');
    const data = await c.req.json();
    
    // 檢查案場是否存在
    const existingSite = await c.env.DB_CRM
      .prepare('SELECT * FROM object_8w9cb__c WHERE _id = ?')
      .bind(siteId)
      .first();
    
    if (!existingSite) {
      return createErrorResponse(c, 'Site not found', 404);
    }

    // 權限檢查：檢查用戶是否有權限修改此案場相關的專案
    if (!user.is_super_admin && existingSite.field_1P96q__c) {
      const hasProjectAccess = await c.env.DB_ENGINEERING
        .prepare(`
          SELECT 1 FROM projects p
          JOIN project_users pu ON p.id = pu.project_id
          WHERE p.opportunity_id = ? AND pu.user_id = ?
        `)
        .bind(existingSite.field_1P96q__c, user.id)
        .first();
      
      if (!hasProjectAccess) {
        return createErrorResponse(c, 'Access denied to modify this site', 403);
      }
    }

    // 構建更新語句（使用 _id 而非 id，修復原有問題）
    const updateFields = [];
    const params = [];
    
    // 允許更新的欄位
    const allowedFields = {
      'field_2RLi8__c': 'site_address',        // 地址
      'field_2RLmO__c': 'contact_person',      // 聯絡人
      'field_2RNhH__c': 'contact_phone',       // 聯絡電話
      'field_2RPzv__c': 'work_status',         // 工程狀態
      'field_2RS3d__c': 'completion_date',     // 完工日期
      'field_2RTbj__c': 'notes'                // 備註
    };
    
    Object.entries(data).forEach(([key, value]) => {
      if (allowedFields[key] && value !== undefined) {
        updateFields.push(`${key} = ?`);
        params.push(value);
      }
    });
    
    if (updateFields.length === 0) {
      return createErrorResponse(c, 'No valid fields to update', 400);
    }
    
    // 添加更新時間和更新者
    updateFields.push('updated_at = datetime("now")');
    updateFields.push('updated_by = ?');
    params.push(user.email || user.id);
    
    params.push(siteId); // WHERE 條件的參數
    
    // 執行更新 (使用正確的 _id 欄位)
    const result = await c.env.DB_CRM
      .prepare(`UPDATE object_8w9cb__c SET ${updateFields.join(', ')} WHERE _id = ?`)
      .bind(...params)
      .run();

    if (result.changes === 0) {
      return createErrorResponse(c, 'Site not found or no changes made', 404);
    }

    // 獲取更新後的資料
    const updatedSite = await c.env.DB_CRM
      .prepare('SELECT * FROM object_8w9cb__c WHERE _id = ?')
      .bind(siteId)
      .first();

    return createSuccessResponse(c, { 
      site: updatedSite 
    }, 'Site updated successfully');

  } catch (error) {
    console.error('Update site error:', error);
    return createErrorResponse(c, 'Failed to update site', 500);
  }
});

// ========================================
// 創建案場 (如果需要)
// ========================================

sites.post('/', async (c) => {
  try {
    const user = c.get('user');
    const data = await c.req.json();
    
    // 驗證必要欄位
    if (!data.field_2RKz7__c || !data.field_1P96q__c) {
      return createErrorResponse(c, 'Site name and opportunity ID are required', 400);
    }

    // 檢查機會是否存在對應的專案
    if (!user.is_super_admin) {
      const hasProjectAccess = await c.env.DB_ENGINEERING
        .prepare(`
          SELECT 1 FROM projects p
          JOIN project_users pu ON p.id = pu.project_id
          WHERE p.opportunity_id = ? AND pu.user_id = ?
        `)
        .bind(data.field_1P96q__c, user.id)
        .first();
      
      if (!hasProjectAccess) {
        return createErrorResponse(c, 'Access denied to create site for this opportunity', 403);
      }
    }

    // 生成新的 _id
    const siteId = crypto.randomUUID();
    
    // 插入新案場
    const insertFields = ['_id', 'field_1P96q__c', 'field_2RKz7__c', 'created_at', 'created_by'];
    const insertValues = ['?', '?', '?', 'datetime("now")', '?'];
    const insertParams = [siteId, data.field_1P96q__c, data.field_2RKz7__c, user.email || user.id];
    
    // 添加其他可選欄位
    const optionalFields = {
      'field_2RLi8__c': 'site_address',
      'field_2RLmO__c': 'contact_person',
      'field_2RNhH__c': 'contact_phone',
      'field_2RPzv__c': 'work_status',
      'field_2RTbj__c': 'notes'
    };
    
    Object.entries(optionalFields).forEach(([field, key]) => {
      if (data[field] !== undefined) {
        insertFields.push(field);
        insertValues.push('?');
        insertParams.push(data[field]);
      }
    });
    
    await c.env.DB_CRM
      .prepare(`
        INSERT INTO object_8w9cb__c (${insertFields.join(', ')})
        VALUES (${insertValues.join(', ')})
      `)
      .bind(...insertParams)
      .run();

    // 獲取創建的案場
    const newSite = await c.env.DB_CRM
      .prepare('SELECT * FROM object_8w9cb__c WHERE _id = ?')
      .bind(siteId)
      .first();

    return createSuccessResponse(c, { site: newSite }, 'Site created successfully');

  } catch (error) {
    console.error('Create site error:', error);
    return createErrorResponse(c, 'Failed to create site', 500);
  }
});

// ========================================
// 刪除案場 (謹慎操作)
// ========================================

sites.delete('/:id', async (c) => {
  try {
    const siteId = c.req.param('id');
    const user = c.get('user');
    
    // 只有 Super Admin 可以刪除案場
    if (!user.is_super_admin) {
      return createErrorResponse(c, 'Only super admin can delete sites', 403);
    }

    const result = await c.env.DB_CRM
      .prepare('DELETE FROM object_8w9cb__c WHERE _id = ?')
      .bind(siteId)
      .run();

    if (result.changes === 0) {
      return createErrorResponse(c, 'Site not found', 404);
    }

    return createSuccessResponse(c, null, 'Site deleted successfully');

  } catch (error) {
    console.error('Delete site error:', error);
    return createErrorResponse(c, 'Failed to delete site', 500);
  }
});

// ========================================
// 獲取案場統計資訊
// ========================================

sites.get('/stats/summary', async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);
    const projectId = url.searchParams.get('project_id');
    
    let conditions = [];
    let params = [];
    
    // 如果指定了專案，只統計該專案的案場
    if (projectId) {
      const project = await c.env.DB_ENGINEERING
        .prepare('SELECT opportunity_id FROM projects WHERE id = ?')
        .bind(projectId)
        .first();
      
      if (project && project.opportunity_id) {
        conditions.push('field_1P96q__c = ?');
        params.push(project.opportunity_id);
      } else {
        return createSuccessResponse(c, {
          total: 0,
          by_status: {},
          recent_updates: []
        });
      }
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // 總數統計
    const totalResult = await c.env.DB_CRM
      .prepare(`SELECT COUNT(*) as total FROM object_8w9cb__c ${whereClause}`)
      .bind(...params)
      .first();
    
    // 按狀態統計
    const statusResult = await c.env.DB_CRM
      .prepare(`
        SELECT 
          field_2RPzv__c as status,
          COUNT(*) as count 
        FROM object_8w9cb__c 
        ${whereClause}
        GROUP BY field_2RPzv__c
      `)
      .bind(...params)
      .all();
    
    // 最近更新的案場
    const recentResult = await c.env.DB_CRM
      .prepare(`
        SELECT 
          _id,
          field_2RKz7__c as name,
          field_2RPzv__c as status,
          updated_at
        FROM object_8w9cb__c 
        ${whereClause}
        ORDER BY updated_at DESC 
        LIMIT 5
      `)
      .bind(...params)
      .all();

    // 轉換狀態統計為物件格式
    const byStatus = {};
    (statusResult.results || []).forEach(row => {
      byStatus[row.status || 'unknown'] = row.count;
    });

    return createSuccessResponse(c, {
      total: totalResult.total || 0,
      by_status: byStatus,
      recent_updates: recentResult.results || []
    });

  } catch (error) {
    console.error('Get site stats error:', error);
    return createErrorResponse(c, 'Failed to get site statistics', 500);
  }
});

export default sites;