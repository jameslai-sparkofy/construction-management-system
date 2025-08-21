import { ResponseHelper } from '../utils/response.js';

/**
 * Workers Routes - 處理工地師父相關的 API 請求
 */
export class WorkersRoutes {
  constructor(dualDatabaseService) {
    this.dualDatabaseService = dualDatabaseService;
  }

  /**
   * 創建新的工地師父
   * 流程：App → CRM → 取得 CRM ID → 寫入 D1 → 返回完整資料
   */
  async createWorker(request) {
    try {
      const body = await request.json();
      
      // 驗證必填欄位
      if (!body.name || !body.name.trim()) {
        return ResponseHelper.error('姓名為必填欄位', 400);
      }

      // 驗證權限（從 request header 獲取用戶資訊）
      const userId = request.headers.get('X-User-Id');
      if (!userId) {
        return ResponseHelper.error('未授權', 401);
      }

      console.log('[WorkersRoutes] Creating worker:', body);

      // 準備師父資料
      const workerData = {
        name: body.name.trim(),
        phone: body.phone?.trim(),
        abbreviation: body.abbreviation?.trim(),
        password: body.password?.trim(),
        account: body.account?.trim(),
        lineUserId: body.line_user_id?.trim(),
        teamId: body.team_id?.trim(),
        owner: body.owner || userId // 使用傳入的負責人或當前用戶
      };

      // 調用 DualDatabaseService 創建師父
      const result = await this.dualDatabaseService.createWorkerWithSync(workerData);
      
      if (!result.success) {
        return ResponseHelper.error(result.error || '創建師父失敗', 500);
      }

      return ResponseHelper.success({
        message: '工地師父創建成功',
        worker: {
          id: result.workerId, // D1 本地 ID
          crm_id: result.crmId, // CRM ID
          name: result.name,
          phone: result.phone,
          abbreviation: result.abbreviation,
          team_id: result.teamId,
          created_at: result.createdAt
        }
      });

    } catch (error) {
      console.error('[WorkersRoutes] Create worker error:', error);
      return ResponseHelper.error('創建師父失敗', 500);
    }
  }

  /**
   * 獲取工地師父列表
   */
  async getWorkers(request) {
    try {
      const url = new URL(request.url);
      const teamId = url.searchParams.get('team_id');
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const offset = parseInt(url.searchParams.get('offset')) || 0;

      let query = `
        SELECT 
          id,
          crm_id,
          name,
          phone,
          abbreviation,
          account,
          line_user_id,
          team_id,
          avatar_url,
          created_at,
          updated_at,
          sync_status
        FROM workers 
      `;

      const params = [];

      if (teamId) {
        query += ' WHERE team_id = ?';
        params.push(teamId);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await this.dualDatabaseService.dbEngineering
        .prepare(query)
        .bind(...params)
        .all();

      const workers = result.results.map(worker => ({
        id: worker.id,
        crm_id: worker.crm_id,
        name: worker.name,
        phone: worker.phone,
        abbreviation: worker.abbreviation,
        account: worker.account,
        line_user_id: worker.line_user_id,
        team_id: worker.team_id,
        avatar_url: worker.avatar_url,
        created_at: worker.created_at,
        updated_at: worker.updated_at,
        sync_status: worker.sync_status
      }));

      return ResponseHelper.success({
        workers,
        total: workers.length,
        limit,
        offset
      });

    } catch (error) {
      console.error('[WorkersRoutes] Get workers error:', error);
      return ResponseHelper.error('獲取師父列表失敗', 500);
    }
  }

  /**
   * 獲取單個工地師父詳情
   */
  async getWorkerById(request, params) {
    try {
      const { workerId } = params;

      const worker = await this.dualDatabaseService.dbEngineering
        .prepare(`
          SELECT 
            id,
            crm_id,
            name,
            phone,
            abbreviation,
            account,
            line_user_id,
            team_id,
            avatar_url,
            created_at,
            updated_at,
            sync_status
          FROM workers 
          WHERE id = ? OR crm_id = ?
        `)
        .bind(workerId, workerId)
        .first();

      if (!worker) {
        return ResponseHelper.error('師父不存在', 404);
      }

      return ResponseHelper.success({
        worker: {
          id: worker.id,
          crm_id: worker.crm_id,
          name: worker.name,
          phone: worker.phone,
          abbreviation: worker.abbreviation,
          account: worker.account,
          line_user_id: worker.line_user_id,
          team_id: worker.team_id,
          avatar_url: worker.avatar_url,
          created_at: worker.created_at,
          updated_at: worker.updated_at,
          sync_status: worker.sync_status
        }
      });

    } catch (error) {
      console.error('[WorkersRoutes] Get worker error:', error);
      return ResponseHelper.error('獲取師父詳情失敗', 500);
    }
  }

  /**
   * 更新工地師父資料
   */
  async updateWorker(request, params) {
    try {
      const { workerId } = params;
      const body = await request.json();

      // 驗證權限
      const userId = request.headers.get('X-User-Id');
      if (!userId) {
        return ResponseHelper.error('未授權', 401);
      }

      // 獲取現有師父資料
      const existingWorker = await this.dualDatabaseService.dbEngineering
        .prepare('SELECT * FROM workers WHERE id = ? OR crm_id = ?')
        .bind(workerId, workerId)
        .first();

      if (!existingWorker) {
        return ResponseHelper.error('師父不存在', 404);
      }

      // 準備更新資料
      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.phone !== undefined) updateData.phone = body.phone?.trim();
      if (body.abbreviation !== undefined) updateData.abbreviation = body.abbreviation?.trim();
      if (body.password !== undefined) updateData.password = body.password?.trim();
      if (body.account !== undefined) updateData.account = body.account?.trim();
      if (body.line_user_id !== undefined) updateData.line_user_id = body.line_user_id?.trim();
      if (body.team_id !== undefined) updateData.team_id = body.team_id?.trim();
      if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url?.trim();

      if (Object.keys(updateData).length === 0) {
        return ResponseHelper.error('沒有提供要更新的欄位', 400);
      }

      console.log('[WorkersRoutes] Updating worker:', workerId, updateData);

      // 更新 D1 資料庫
      const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateValues = Object.values(updateData);
      
      await this.dualDatabaseService.dbEngineering
        .prepare(`
          UPDATE workers 
          SET ${updateFields}, updated_at = datetime('now')
          WHERE crm_id = ?
        `)
        .bind(...updateValues, existingWorker.crm_id)
        .run();

      // 標記為待同步到 CRM（背景處理）
      await this.dualDatabaseService.backgroundSync.markWorkerForSync(
        existingWorker.crm_id, 
        updateData, 
        'update'
      );

      // 獲取更新後的資料
      const updatedWorker = await this.dualDatabaseService.dbEngineering
        .prepare('SELECT * FROM workers WHERE crm_id = ?')
        .bind(existingWorker.crm_id)
        .first();

      return ResponseHelper.success({
        message: '師父資料更新成功',
        worker: {
          id: updatedWorker.id,
          crm_id: updatedWorker.crm_id,
          name: updatedWorker.name,
          phone: updatedWorker.phone,
          abbreviation: updatedWorker.abbreviation,
          account: updatedWorker.account,
          line_user_id: updatedWorker.line_user_id,
          team_id: updatedWorker.team_id,
          avatar_url: updatedWorker.avatar_url,
          updated_at: updatedWorker.updated_at
        }
      });

    } catch (error) {
      console.error('[WorkersRoutes] Update worker error:', error);
      return ResponseHelper.error('更新師父資料失敗', 500);
    }
  }

  /**
   * 刪除工地師父
   */
  async deleteWorker(request, params) {
    try {
      const { workerId } = params;

      // 驗證權限
      const userId = request.headers.get('X-User-Id');
      if (!userId) {
        return ResponseHelper.error('未授權', 401);
      }

      // 檢查師父是否存在
      const worker = await this.dualDatabaseService.dbEngineering
        .prepare('SELECT * FROM workers WHERE id = ? OR crm_id = ?')
        .bind(workerId, workerId)
        .first();

      if (!worker) {
        return ResponseHelper.error('師父不存在', 404);
      }

      console.log('[WorkersRoutes] Deleting worker:', workerId);

      // 軟刪除：標記為待同步到 CRM
      await this.dualDatabaseService.backgroundSync.markWorkerForSync(
        worker.crm_id, 
        { life_status: '作废' }, 
        'delete'
      );

      // 從 D1 刪除
      await this.dualDatabaseService.dbEngineering
        .prepare('DELETE FROM workers WHERE crm_id = ?')
        .bind(worker.crm_id)
        .run();

      return ResponseHelper.success({
        message: '師父已刪除',
        worker_id: worker.crm_id
      });

    } catch (error) {
      console.error('[WorkersRoutes] Delete worker error:', error);
      return ResponseHelper.error('刪除師父失敗', 500);
    }
  }

  /**
   * 設定路由
   */
  setupRoutes(router) {
    // 創建工地師父
    router.post('/api/v1/workers', (request) => 
      this.createWorker(request)
    );

    // 獲取師父列表
    router.get('/api/v1/workers', (request) => 
      this.getWorkers(request)
    );

    // 獲取單個師父詳情
    router.get('/api/v1/workers/:workerId', (request, params) => 
      this.getWorkerById(request, params)
    );

    // 更新師父資料
    router.put('/api/v1/workers/:workerId', (request, params) => 
      this.updateWorker(request, params)
    );

    // 刪除師父
    router.delete('/api/v1/workers/:workerId', (request, params) => 
      this.deleteWorker(request, params)
    );
  }
}