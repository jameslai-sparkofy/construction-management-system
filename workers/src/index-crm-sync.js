/**
 * 工程管理系統 API - CRM 同步版本
 * 測試新的 CRM 同步功能
 */

import { DualDatabaseService } from './services/dualDatabaseService.js';
import { WorkersRoutes } from './routes/workers.js';
import { SitesRoutes } from './routes/sites.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
      'Content-Type': 'application/json'
    };

    // 處理 OPTIONS 請求
    if (method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    try {
      // 初始化服務
      const dualDbService = new DualDatabaseService(env);
      const workersRoutes = new WorkersRoutes(dualDbService);
      const sitesRoutes = new SitesRoutes(dualDbService);

      // 簡化的路由器
      const router = {
        routes: [],
        get(path, handler) { this.routes.push({ method: 'GET', path, handler }); },
        post(path, handler) { this.routes.push({ method: 'POST', path, handler }); },
        put(path, handler) { this.routes.push({ method: 'PUT', path, handler }); },
        delete(path, handler) { this.routes.push({ method: 'DELETE', path, handler }); },
        
        match(method, path) {
          for (const route of this.routes) {
            if (route.method === method) {
              const match = this.matchPath(route.path, path);
              if (match) {
                return { handler: route.handler, params: match.params };
              }
            }
          }
          return null;
        },
        
        matchPath(routePath, actualPath) {
          const routeParts = routePath.split('/');
          const actualParts = actualPath.split('/');
          
          if (routeParts.length !== actualParts.length) {
            return null;
          }
          
          const params = {};
          for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
              const paramName = routeParts[i].substring(1);
              params[paramName] = actualParts[i];
            } else if (routeParts[i] !== actualParts[i]) {
              return null;
            }
          }
          
          return { params };
        }
      };

      // 註冊路由
      workersRoutes.setupRoutes(router);
      sitesRoutes.setupRoutes(router);

      // 添加額外的測試路由
      
      // 健康檢查
      router.get('/health', async () => {
        return new Response(JSON.stringify({
          success: true,
          message: 'CRM Sync API is running',
          timestamp: new Date().toISOString(),
          services: {
            fxCrmSync: await dualDbService.fxCrmSync.healthCheck(),
            backgroundSync: 'active'
          }
        }), { status: 200, headers });
      });

      // 同步狀態
      router.get('/api/v1/sync/status', async () => {
        const stats = await dualDbService.getSyncStats();
        return new Response(JSON.stringify({
          success: true,
          data: stats
        }), { status: 200, headers });
      });

      // 重試失敗的同步
      router.post('/api/v1/sync/retry', async () => {
        const result = await dualDbService.retryFailedSyncs();
        return new Response(JSON.stringify(result), { 
          status: result.success ? 200 : 500, 
          headers 
        });
      });

      // 創建資料庫表（測試用）
      router.post('/api/v1/setup/tables', async () => {
        try {
          // 執行資料庫遷移 - 分別執行 SQL 語句
          const dropStatements = [
            `DROP TABLE IF EXISTS object_50hj8__c`
          ];

          const sqlStatements = [
            `CREATE TABLE IF NOT EXISTS sync_queue (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              object_type TEXT NOT NULL,
              object_id TEXT NOT NULL,
              operation TEXT NOT NULL,
              data TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              retry_count INTEGER DEFAULT 0,
              error_message TEXT,
              next_retry_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              completed_at DATETIME
            )`,
            `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
            `CREATE INDEX IF NOT EXISTS idx_sync_queue_object ON sync_queue(object_type, object_id)`,
            `CREATE TABLE IF NOT EXISTS project_users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              user_type TEXT DEFAULT 'user',
              role TEXT NOT NULL,
              permissions TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(project_id, user_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_project_users_project ON project_users(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_project_users_user ON project_users(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_project_users_type ON project_users(user_type)`,
            `CREATE TABLE IF NOT EXISTS object_50hj8__c (
              _id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              phone_number__c TEXT,
              abbreviation__c TEXT,
              password__c TEXT,
              account__c TEXT,
              LINE_user_id__c TEXT,
              field_D1087__c TEXT,
              tenant_id TEXT,
              object_describe_api_name TEXT,
              owner TEXT,
              create_time INTEGER,
              last_modified_time INTEGER,
              life_status TEXT DEFAULT '正常',
              sync_status TEXT DEFAULT 'local_only',
              local_id TEXT,
              crm_id TEXT,
              error_message TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE INDEX IF NOT EXISTS idx_object_50hj8_sync_status ON object_50hj8__c(sync_status)`,
            `CREATE INDEX IF NOT EXISTS idx_object_50hj8_local_id ON object_50hj8__c(local_id)`,
            `CREATE INDEX IF NOT EXISTS idx_object_50hj8_crm_id ON object_50hj8__c(crm_id)`
          ];


          const results = [];

          // 執行 DROP 語句
          for (const sql of dropStatements) {
            try {
              await env.DB_ENGINEERING.prepare(sql).run();
              results.push(`DROP 成功: ${sql.substring(0, 50)}...`);
            } catch (err) {
              results.push(`DROP 失敗: ${sql.substring(0, 50)}... - ${err.message}`);
            }
          }

          // 執行基本表和索引創建
          for (const sql of sqlStatements) {
            try {
              await env.DB_ENGINEERING.prepare(sql).run();
              results.push(`執行成功: ${sql.substring(0, 50)}...`);
            } catch (err) {
              results.push(`執行失敗: ${sql.substring(0, 50)}... - ${err.message}`);
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: '資料庫表結構更新完成',
            details: results
          }), { status: 200, headers });

        } catch (error) {
          console.error('Setup tables error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 批量同步現有工地師父到 CRM
      router.post('/api/v1/workers/batch-sync', async () => {
        try {
          const result = await dualDbService.batchSyncExistingWorkers();
          return new Response(JSON.stringify({
            success: true,
            data: result,
            message: `同步完成：成功 ${result.success} 個，失敗 ${result.failed} 個`
          }), { status: 200, headers });

        } catch (error) {
          console.error('Batch sync workers error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 查看工地師父同步狀態
      router.get('/api/v1/workers/sync-status', async () => {
        try {
          const stats = await env.DB_ENGINEERING.prepare(`
            SELECT 
              sync_status,
              COUNT(*) as count
            FROM object_50hj8__c 
            WHERE life_status != '作废'
            GROUP BY sync_status
          `).all();

          const statusMap = {};
          for (const row of stats.results) {
            statusMap[row.sync_status || 'no_status'] = row.count;
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              sync_status_counts: statusMap,
              total: Object.values(statusMap).reduce((sum, count) => sum + count, 0)
            }
          }), { status: 200, headers });

        } catch (error) {
          console.error('Get worker sync status error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 新增工地師父到專案
      router.post('/api/v1/projects/:projectId/workers', async (request, params) => {
        try {
          const { projectId } = params;
          const body = await request.json();
          const workerId = body.worker_id; // 可以是本地 UUID 或 CRM ID
          const role = body.role || 'worker';

          // 檢查工地師父是否存在
          const worker = await env.DB_ENGINEERING.prepare(`
            SELECT _id, name, sync_status FROM object_50hj8__c 
            WHERE _id = ? AND life_status != '作废'
          `).bind(workerId).first();

          if (!worker) {
            return new Response(JSON.stringify({
              success: false,
              error: '工地師父不存在'
            }), { status: 404, headers });
          }

          // 加入專案
          await env.DB_ENGINEERING.prepare(`
            INSERT OR REPLACE INTO project_users (
              project_id, user_id, user_type, role, updated_at
            ) VALUES (?, ?, 'worker', ?, datetime('now'))
          `).bind(projectId, workerId, role).run();

          return new Response(JSON.stringify({
            success: true,
            message: `工地師父 ${worker.name} 已加入專案`,
            data: {
              project_id: projectId,
              worker_id: workerId,
              worker_name: worker.name,
              role: role,
              sync_status: worker.sync_status
            }
          }), { status: 200, headers });

        } catch (error) {
          console.error('Add worker to project error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 獲取專案的工地師父列表
      router.get('/api/v1/projects/:projectId/workers', async (request, params) => {
        try {
          const { projectId } = params;

          const workers = await env.DB_ENGINEERING.prepare(`
            SELECT 
              pu.user_id,
              pu.role,
              pu.created_at as joined_at,
              w.name,
              w.phone_number__c as phone,
              w.abbreviation__c as abbreviation,
              w.sync_status,
              w.crm_id
            FROM project_users pu
            JOIN object_50hj8__c w ON pu.user_id = w._id
            WHERE pu.project_id = ? AND pu.user_type = 'worker'
              AND w.life_status != '作废'
            ORDER BY pu.created_at DESC
          `).bind(projectId).all();

          return new Response(JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              workers: workers.results.map(w => ({
                id: w.user_id,
                name: w.name,
                phone: w.phone,
                abbreviation: w.abbreviation,
                role: w.role,
                sync_status: w.sync_status,
                crm_id: w.crm_id,
                joined_at: w.joined_at
              }))
            }
          }), { status: 200, headers });

        } catch (error) {
          console.error('Get project workers error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 測試創建工地師父並立即加入專案
      router.post('/api/v1/test/create-worker-and-join', async (request) => {
        try {
          const body = await request.json();
          const projectId = body.project_id || 'proj_1755555899996';

          // 1. 創建工地師父
          const workerData = {
            name: body.name || '測試師父-' + Date.now(),
            phone: body.phone || '0912' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
            abbreviation: body.abbreviation || '測試',
            teamId: body.team_id || null
          };

          const workerResult = await dualDbService.createWorkerWithSync(workerData);

          // 2. 立即加入專案（使用本地 UUID）
          await env.DB_ENGINEERING.prepare(`
            INSERT INTO project_users (
              project_id, user_id, user_type, role
            ) VALUES (?, ?, 'worker', 'worker')
          `).bind(projectId, workerResult.workerId).run();

          return new Response(JSON.stringify({
            success: true,
            message: '工地師父已創建並加入專案，正在同步到 CRM',
            data: {
              worker: workerResult,
              project_id: projectId,
              note: 'CRM ID 將在背景同步完成後自動更新'
            }
          }), { status: 200, headers });

        } catch (error) {
          console.error('Create worker and join error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 獲取紛享銷客用戶列表
      router.get('/api/v1/fx/users', async () => {
        try {
          const users = await dualDbService.fxCrmSync.getUserList();
          return new Response(JSON.stringify({
            success: true,
            data: users
          }), { status: 200, headers });

        } catch (error) {
          console.error('Get FX users error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 測試案場更新 - 建功段案場
      router.post('/api/v1/test/construction-complete', async (request) => {
        try {
          const body = await request.json();
          const siteId = body.site_id || '677633f67f855e00016ff02b'; // 預設建功段案場 ID
          
          const progressData = {
            projectId: body.project_id || 'proj_1755555899996',
            siteId: siteId,
            engineeringType: 'SPC',
            status: 'completed',
            shiftTime: '早班',
            workerName: '測試師父',
            constructionDate: new Date().toISOString().split('T')[0],
            notes: '施工完成測試 - ' + new Date().toLocaleString('zh-TW'),
            beforePhotoUrl: 'https://example.com/before.jpg',
            afterPhotoUrl: 'https://example.com/after.jpg',
            constructionArea: 30
          };

          const result = await dualDbService.updateConstructionProgress(progressData);

          return new Response(JSON.stringify({
            success: true,
            data: result,
            message: '建功段案場施工完成狀態已更新，正在背景同步到 CRM'
          }), { status: 200, headers });

        } catch (error) {
          console.error('Test construction complete error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { status: 500, headers });
        }
      });

      // 路由匹配
      const match = router.match(method, path);
      if (match) {
        const result = await match.handler(request, match.params);
        return result;
      }

      // 404 - 路由不存在
      return new Response(JSON.stringify({
        success: false,
        error: 'Route not found',
        path,
        method,
        available_routes: router.routes.map(r => `${r.method} ${r.path}`)
      }), { status: 404, headers });

    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), { status: 500, headers });
    }
  }
};