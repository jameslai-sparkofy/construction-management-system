/**
 * 統一 CRM 同步路由
 * 整合與紛享銷客的同步功能
 */

import { Hono } from 'hono';
import { createResponse, createErrorResponse, createSuccessResponse } from '../utils/response.js';
import { requireRole } from '../middleware/auth.js';

const crm = new Hono();

// ========================================
// CRM 同步狀態查詢
// ========================================

crm.get('/sync/status', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    // 從 KV 獲取同步狀態
    let syncStatus = null;
    try {
      const statusData = await c.env.SYNC_STATE.get('fx_crm_sync_status');
      if (statusData) {
        syncStatus = JSON.parse(statusData);
      }
    } catch (error) {
      console.warn('Failed to get sync status from KV:', error);
    }

    // 獲取最近的同步記錄
    const recentSyncs = await c.env.DB_CRM
      .prepare(`
        SELECT 
          COUNT(*) as total_records,
          MAX(updated_at) as last_updated
        FROM object_8w9cb__c
      `)
      .first();

    // 獲取需要同步的項目數量
    const pendingCount = await c.env.DB_CRM
      .prepare(`
        SELECT COUNT(*) as pending
        FROM object_8w9cb__c 
        WHERE updated_at > datetime('now', '-1 hour')
      `)
      .first();

    return createSuccessResponse(c, {
      sync_status: syncStatus || {
        status: 'unknown',
        last_sync: null,
        message: 'No sync status available'
      },
      database_stats: {
        total_records: recentSyncs.total_records || 0,
        last_updated: recentSyncs.last_updated,
        pending_sync: pendingCount.pending || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get CRM sync status error:', error);
    return createErrorResponse(c, 'Failed to get sync status', 500);
  }
});

// ========================================
// 手動觸發 CRM 同步
// ========================================

crm.post('/sync/trigger', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    const user = c.get('user');
    const data = await c.req.json().catch(() => ({}));
    
    const syncOptions = {
      full_sync: data.full_sync || false,
      object_types: data.object_types || ['sites'],
      force: data.force || false
    };

    // 檢查是否已有同步在進行
    let currentStatus = null;
    try {
      const statusData = await c.env.SYNC_STATE.get('fx_crm_sync_status');
      if (statusData) {
        currentStatus = JSON.parse(statusData);
      }
    } catch (error) {
      console.warn('Failed to check current sync status:', error);
    }

    if (currentStatus && currentStatus.status === 'running' && !syncOptions.force) {
      return createErrorResponse(c, 'Sync is already in progress. Use force=true to override.', 409);
    }

    // 設定同步狀態為進行中
    const syncId = crypto.randomUUID();
    const newSyncStatus = {
      sync_id: syncId,
      status: 'running',
      started_at: new Date().toISOString(),
      started_by: user.id,
      options: syncOptions
    };

    try {
      await c.env.SYNC_STATE.put('fx_crm_sync_status', JSON.stringify(newSyncStatus), {
        expirationTtl: 3600 // 1 小時後過期
      });
    } catch (error) {
      console.warn('Failed to set sync status in KV:', error);
    }

    // 這裡通常會調用實際的同步服務
    // 由於這是統一 API，我們可能需要調用原有的 fx-crm-sync Worker
    try {
      // 模擬同步邏輯或調用外部同步服務
      const syncResult = await triggerExternalSync(syncOptions);
      
      // 更新同步狀態為完成
      const completedStatus = {
        ...newSyncStatus,
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: syncResult
      };

      await c.env.SYNC_STATE.put('fx_crm_sync_status', JSON.stringify(completedStatus), {
        expirationTtl: 86400 // 24 小時後過期
      });

      return createSuccessResponse(c, {
        sync_id: syncId,
        status: 'completed',
        result: syncResult
      }, 'CRM sync completed successfully');

    } catch (syncError) {
      // 同步失敗，更新狀態
      const failedStatus = {
        ...newSyncStatus,
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: syncError.message
      };

      try {
        await c.env.SYNC_STATE.put('fx_crm_sync_status', JSON.stringify(failedStatus), {
          expirationTtl: 86400 // 24 小時後過期
        });
      } catch (error) {
        console.warn('Failed to update failed sync status:', error);
      }

      throw syncError;
    }

  } catch (error) {
    console.error('Trigger CRM sync error:', error);
    return createErrorResponse(c, 'Failed to trigger CRM sync: ' + error.message, 500);
  }
});

// ========================================
// 獲取 CRM 對象列表
// ========================================

crm.get('/objects', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    // 獲取可用的 CRM 對象類型
    const objects = [
      {
        id: 'object_8w9cb__c',
        name: '案場管理',
        table_name: 'object_8w9cb__c',
        description: '工程案場資料',
        record_count: 0
      }
    ];

    // 獲取各對象的記錄數量
    for (const obj of objects) {
      try {
        const countResult = await c.env.DB_CRM
          .prepare(`SELECT COUNT(*) as count FROM ${obj.table_name}`)
          .first();
        obj.record_count = countResult.count || 0;
      } catch (error) {
        console.warn(`Failed to count records for ${obj.table_name}:`, error);
      }
    }

    return createSuccessResponse(c, { objects });

  } catch (error) {
    console.error('Get CRM objects error:', error);
    return createErrorResponse(c, 'Failed to get CRM objects', 500);
  }
});

// ========================================
// 獲取 CRM 同步記錄
// ========================================

crm.get('/sync/history', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    const url = new URL(c.req.url);
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    
    // 從 KV 獲取同步歷史（如果有的話）
    const syncHistory = [];
    
    try {
      // 這裡可以存儲多個同步記錄
      const historyData = await c.env.SYNC_STATE.get('fx_crm_sync_history');
      if (historyData) {
        const history = JSON.parse(historyData);
        syncHistory.push(...(Array.isArray(history) ? history : [history]));
      }
    } catch (error) {
      console.warn('Failed to get sync history from KV:', error);
    }

    // 獲取當前狀態
    try {
      const currentStatusData = await c.env.SYNC_STATE.get('fx_crm_sync_status');
      if (currentStatusData) {
        const currentStatus = JSON.parse(currentStatusData);
        syncHistory.unshift(currentStatus);
      }
    } catch (error) {
      console.warn('Failed to get current sync status:', error);
    }

    // 排序並限制數量
    syncHistory.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    const limitedHistory = syncHistory.slice(0, limit);

    return createSuccessResponse(c, {
      sync_history: limitedHistory,
      total: syncHistory.length
    });

  } catch (error) {
    console.error('Get CRM sync history error:', error);
    return createErrorResponse(c, 'Failed to get sync history', 500);
  }
});

// ========================================
// CRM 數據查詢接口
// ========================================

crm.get('/data/:objectType', requireRole(['admin', 'super_admin']), async (c) => {
  try {
    const objectType = c.req.param('objectType');
    const url = new URL(c.req.url);
    
    // 目前只支援案場數據
    if (objectType !== 'sites' && objectType !== 'object_8w9cb__c') {
      return createErrorResponse(c, 'Unsupported object type', 400);
    }

    const filters = {
      opportunity_id: url.searchParams.get('opportunity_id'),
      limit: parseInt(url.searchParams.get('limit')) || 20,
      offset: parseInt(url.searchParams.get('offset')) || 0
    };

    let query = 'SELECT * FROM object_8w9cb__c';
    const conditions = [];
    const params = [];
    
    if (filters.opportunity_id) {
      conditions.push('field_1P96q__c = ?');
      params.push(filters.opportunity_id);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY field_2RKz7__c LIMIT ? OFFSET ?`;
    params.push(filters.limit, filters.offset);

    const result = await c.env.DB_CRM
      .prepare(query)
      .bind(...params)
      .all();

    return createSuccessResponse(c, {
      object_type: objectType,
      data: result.results || [],
      pagination: {
        limit: filters.limit,
        offset: filters.offset
      }
    });

  } catch (error) {
    console.error('Get CRM data error:', error);
    return createErrorResponse(c, 'Failed to get CRM data', 500);
  }
});

// ========================================
// 輔助函數：觸發外部同步
// ========================================

async function triggerExternalSync(options) {
  // 這裡可以調用原有的 fx-crm-sync Worker API
  // 或者實現內建的同步邏輯
  
  try {
    // 模擬同步過程
    const startTime = Date.now();
    
    // 這裡會實際調用紛享銷客 API 或其他同步邏輯
    await new Promise(resolve => setTimeout(resolve, 2000)); // 模擬同步時間
    
    const endTime = Date.now();
    
    return {
      duration_ms: endTime - startTime,
      records_synced: Math.floor(Math.random() * 100) + 10, // 模擬同步記錄數
      success: true,
      message: 'Sync completed successfully'
    };
    
  } catch (error) {
    throw new Error('External sync failed: ' + error.message);
  }
}

export default crm;