/**
 * 統一工程管理 API Gateway
 * 整合原有的多個微服務為單一入口點
 * Version 2.0.0 - Unified Architecture
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// 導入中間件和工具
import { createResponse } from './utils/response.js';

const app = new Hono();

// ========================================
// 全域中間件
// ========================================

// CORS 配置
app.use('*', cors({
  origin: '*', // 暫時開放所有來源以便測試
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));

// 日誌記錄
app.use('*', logger());

// ========================================
// 健康檢查和系統資訊
// ========================================

app.get('/', (c) => {
  return createResponse(c, {
    message: '🏗️ Construction Management Unified API',
    version: '2.0.0',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/auth/*',
      projects: '/api/v1/projects/*',
      sites: '/api/v1/sites/*',
      users: '/api/v1/users/*',
      files: '/api/v1/files/*',
      crm: '/api/v1/crm/*',
      health: '/health'
    }
  });
});

app.get('/health', async (c) => {
  try {
    // 檢查資料庫連線
    const crmCheck = await c.env.DB_CRM.prepare('SELECT 1').first();
    const engineeringCheck = await c.env.DB_ENGINEERING.prepare('SELECT 1').first();
    
    return createResponse(c, {
      status: 'healthy',
      version: '2.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      timestamp: new Date().toISOString(),
      databases: {
        crm: crmCheck ? 'connected' : 'disconnected',
        engineering: engineeringCheck ? 'connected' : 'disconnected'
      },
      services: {
        kv: c.env.SESSIONS ? 'available' : 'unavailable',
        r2: c.env.CONSTRUCTION_PHOTOS ? 'available' : 'unavailable'
      }
    });
  } catch (error) {
    return createResponse(c, {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 測試端點：驗證 D1 插入操作
app.get('/test-db', async (c) => {
  try {
    console.log('[TEST DB] Starting database test');
    
    // 1. 檢查表結構
    const tableInfo = await c.env.DB_ENGINEERING.prepare(`
      PRAGMA table_info(projects)
    `).all();
    
    console.log('[TEST DB] Table info:', tableInfo.results);
    
    // 2. 嘗試插入測試記錄
    const testId = `test_${Date.now()}`;
    const testQuery = `
      INSERT INTO projects (id, opportunity_id, name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const testParams = [
      testId,
      '66defc17d0d4940001cf0fbf',
      '測試記錄',
      'active',
      new Date().toISOString().replace('T', ' ').replace('Z', ''),
      new Date().toISOString().replace('T', ' ').replace('Z', '')
    ];
    
    console.log('[TEST DB] Inserting with query:', testQuery);
    console.log('[TEST DB] Inserting with params:', testParams);
    
    const insertResult = await c.env.DB_ENGINEERING
      .prepare(testQuery)
      .bind(...testParams)
      .run();
    
    console.log('[TEST DB] Insert result:', insertResult);
    
    // 3. 檢索剛插入的記錄
    const selectResult = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(testId)
      .first();
    
    console.log('[TEST DB] Select result:', selectResult);
    
    return createResponse(c, {
      success: true,
      tableInfo: tableInfo.results,
      insertResult,
      selectResult,
      testId
    });
    
  } catch (error) {
    console.error('[TEST DB] Error:', error);
    return createResponse(c, {
      success: false,
      error: error.message,
      stack: error.stack
    }, 500);
  }
});

// ========================================
// API 路由註冊 (暫時簡化以測試基本功能)
// ========================================

// ========================================
// 認證端點 - 基於原始 AuthService 實現
// ========================================

// 標準化手機號碼
function normalizePhone(phone) {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('886')) {
    cleaned = '0' + cleaned.substring(3);
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('09')) {
    return cleaned;
  }
  
  return null;
}

// 認證狀態檢查
app.get('/api/v1/auth/status', (c) => {
  return createResponse(c, {
    environment: c.env.ENVIRONMENT || 'development',
    emergency_login_enabled: c.env.ENABLE_EMERGENCY_LOGIN === 'true',
    supabase_configured: !!(c.env.SUPABASE_URL && c.env.SUPABASE_ANON_KEY),
    timestamp: new Date().toISOString()
  });
});

// 登入端點 - 完全按照原始 AuthService 邏輯
app.post('/api/v1/auth/login', async (c) => {
  try {
    const { phone, password } = await c.req.json();
    
    if (!phone || !password) {
      return createResponse(c, {
        success: false,
        error: '手機號碼和密碼為必填項'
      }, 400);
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return createResponse(c, {
        success: false,
        error: '手機號碼格式不正確'
      }, 400);
    }

    // 查詢用戶 - 使用原始查詢結構
    const user = await c.env.DB_ENGINEERING.prepare(`
      SELECT id, phone, password_suffix, name, email, global_role, 
             is_active, user_status, failed_login_count, locked_until
      FROM users 
      WHERE phone = ? AND is_active = 1
    `).bind(normalizedPhone).first();

    if (!user) {
      return createResponse(c, {
        success: false,
        error: '用戶不存在或已停用'
      }, 404);
    }

    // 檢查帳號鎖定
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return createResponse(c, {
        success: false,
        error: '帳號已被鎖定，請稍後再試'
      }, 403);
    }

    // 檢查用戶狀態
    if (user.user_status === 'suspended') {
      return createResponse(c, {
        success: false,
        error: '帳號已暫停使用'
      }, 403);
    }

    // 驗證密碼 - 使用 password_suffix 欄位
    if (user.password_suffix !== password) {
      // 增加失敗次數
      const newFailCount = (user.failed_login_count || 0) + 1;
      const shouldLock = newFailCount >= 5;
      
      await c.env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET failed_login_count = ?, 
            locked_until = ?
        WHERE id = ?
      `).bind(
        newFailCount,
        shouldLock ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
        user.id
      ).run();

      return createResponse(c, {
        success: false,
        error: shouldLock ? '密碼錯誤次數過多，帳號已鎖定30分鐘' : '密碼錯誤'
      }, 401);
    }

    // 生成簡單的 token
    const token = 'token_' + Date.now() + '_' + crypto.randomUUID();

    // 更新用戶登入資訊
    await c.env.DB_ENGINEERING.prepare(`
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

    // 儲存到 KV (會話管理)
    await c.env.SESSIONS.put(token, JSON.stringify({
      user_id: user.id,
      phone: user.phone,
      role: user.global_role,
      name: user.name,
      login_time: new Date().toISOString()
    }), { expirationTtl: 30 * 24 * 3600 }); // 30天

    // 返回與原始 API 完全相同的格式
    return createResponse(c, {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.global_role,
          user_type: user.global_role,
          is_first_login: user.user_status === 'pending'
        },
        token: token,
        session_id: token,
        expires_in: 30 * 24 * 3600
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return createResponse(c, {
      success: false,
      error: '登入系統錯誤'
    }, 500);
  }
});

// 登出端點
app.post('/api/v1/auth/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    let token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      // 從 KV 移除
      await c.env.SESSIONS.delete(token);
      
      // 從資料庫清除 session_token
      try {
        await c.env.DB_ENGINEERING.prepare(`
          UPDATE users 
          SET session_token = NULL 
          WHERE session_token = ?
        `).bind(token).run();
      } catch (dbError) {
        console.warn('Clear session token error:', dbError);
      }
    }

    return createResponse(c, {
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return createResponse(c, {
      success: false,
      error: '登出失敗'
    }, 500);
  }
});

// ========================================
// 專案管理端點
// ========================================

// 獲取專案列表
app.get('/api/v1/projects', async (c) => {
  try {
    const projects = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 50')
      .all();
    
    return createResponse(c, {
      projects: projects.results || [],
      count: projects.results?.length || 0
    });
  } catch (error) {
    return createResponse(c, { error: error.message }, 500);
  }
});

// 創建新專案 - 完全重寫和簡化
app.post('/api/v1/projects', async (c) => {
  console.log('[PROJECT CREATE] Starting project creation');
  
  try {
    // 1. 解析請求數據
    const projectData = await c.req.json();
    console.log('[PROJECT CREATE] Raw data:', projectData);
    
    // 2. 基本驗證
    if (!projectData || typeof projectData !== 'object') {
      console.log('[PROJECT CREATE] Invalid request data');
      return createResponse(c, {
        success: false,
        error: 'Invalid request data'
      }, 400);
    }

    const { name, opportunityId } = projectData;
    console.log('[PROJECT CREATE] Extracted fields:', { name, opportunityId });

    // 3. 必填欄位驗證
    if (!name) {
      console.log('[PROJECT CREATE] Missing name');
      return createResponse(c, {
        success: false,
        error: 'Project name is required'
      }, 400);
    }

    if (!opportunityId) {
      console.log('[PROJECT CREATE] Missing opportunityId');
      return createResponse(c, {
        success: false,
        error: 'Opportunity ID is required'
      }, 400);
    }

    // 4. 生成專案資料
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = new Date().toISOString().replace('T', ' ').replace('Z', '');
    
    console.log('[PROJECT CREATE] Generated data:', { projectId, opportunityId, name });

    // 5. 直接插入資料庫 - 使用最簡單的方式
    console.log('[PROJECT CREATE] Attempting database insert');
    
    const query = `
      INSERT INTO projects (
        id, opportunity_id, name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      projectId,
      opportunityId,
      name,
      'active',
      currentTime,
      currentTime
    ];
    
    console.log('[PROJECT CREATE] SQL Query:', query);
    console.log('[PROJECT CREATE] SQL Params:', params);

    const result = await c.env.DB_ENGINEERING
      .prepare(query)
      .bind(...params)
      .run();
    
    console.log('[PROJECT CREATE] Insert result:', result);

    // 6. 回傳成功結果
    console.log('[PROJECT CREATE] Success - returning response');
    return createResponse(c, {
      success: true,
      data: {
        project: {
          id: projectId,
          name: name,
          opportunity_id: opportunityId,
          status: 'active',
          created_at: currentTime
        }
      },
      message: 'Project created successfully'
    });

  } catch (error) {
    console.error('[PROJECT CREATE] Error:', error);
    console.error('[PROJECT CREATE] Error stack:', error.stack);
    
    return createResponse(c, {
      success: false,
      error: 'Project creation failed',
      message: error.message,
      debug: error.stack
    }, 500);
  }
});

// 簡單的案場端點
app.get('/api/v1/sites', async (c) => {
  try {
    const sites = await c.env.DB_CRM
      .prepare('SELECT * FROM object_8w9cb__c LIMIT 10')
      .all();
    
    return createResponse(c, {
      sites: sites.results || [],
      count: sites.results?.length || 0
    });
  } catch (error) {
    return createResponse(c, { error: error.message }, 500);
  }
});

// ========================================
// 相容性路由 (為舊 API 提供重定向)
// ========================================

// 舊版 auth 路由相容性
app.get('/auth/*', (c) => {
  const path = c.req.path.replace('/auth', '/api/v1/auth');
  return c.redirect(path, 301);
});

// 舊版直接路由相容性
app.all('/projects/*', (c) => {
  const path = c.req.path.replace('/projects', '/api/v1/projects');
  return c.redirect(path, 301);
});

// ========================================
// 404 處理
// ========================================

app.notFound((c) => {
  return createResponse(c, {
    error: 'Endpoint not found',
    message: `The requested endpoint ${c.req.path} was not found.`,
    available_endpoints: {
      auth: '/api/v1/auth/*',
      projects: '/api/v1/projects/*',
      sites: '/api/v1/sites/*',
      users: '/api/v1/users/*',
      files: '/api/v1/files/*',
      crm: '/api/v1/crm/*'
    }
  }, 404);
});

// ========================================
// 錯誤處理
// ========================================

app.onError((err, c) => {
  console.error('Unified API Error:', err);
  
  return createResponse(c, {
    error: 'Internal Server Error',
    message: c.env.ENABLE_DEBUG === 'true' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  }, 500);
});

export default app;