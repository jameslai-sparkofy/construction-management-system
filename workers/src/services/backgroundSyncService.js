/**
 * 背景同步服務
 * 負責處理 D1 → CRM 的異步同步
 */
export class BackgroundSyncService {
  constructor(env, fxCrmSyncService) {
    this.env = env;
    this.fxCrmSync = fxCrmSyncService;
    this.dbEngineering = env.DB_ENGINEERING;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 秒
  }

  /**
   * 標記需要同步的案場更新
   */
  async markSiteForSync(siteId, updateData, operation = 'update') {
    try {
      await this.dbEngineering.prepare(`
        INSERT OR REPLACE INTO sync_queue (
          object_type,
          object_id, 
          operation,
          data,
          status,
          retry_count,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        'site',
        siteId,
        operation,
        JSON.stringify(updateData),
        'pending',
        0
      ).run();

      console.log('[BackgroundSync] Site marked for sync:', siteId);

      // 觸發背景同步（不等待結果）
      if (this.env.waitUntil) {
        this.env.waitUntil(this.processSyncQueue());
      } else {
        // 在測試環境中立即處理
        this.processSyncQueue().catch(console.error);
      }

    } catch (error) {
      console.error('[BackgroundSync] Failed to mark site for sync:', error);
    }
  }

  /**
   * 標記需要同步的工地師父更新
   */
  async markWorkerForSync(workerId, updateData, operation = 'update') {
    try {
      await this.dbEngineering.prepare(`
        INSERT OR REPLACE INTO sync_queue (
          object_type,
          object_id, 
          operation,
          data,
          status,
          retry_count,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        'worker',
        workerId,
        operation,
        JSON.stringify(updateData),
        'pending',
        0
      ).run();

      console.log('[BackgroundSync] Worker marked for sync:', workerId);

      // 觸發背景同步（不等待結果）
      if (this.env.waitUntil) {
        this.env.waitUntil(this.processSyncQueue());
      } else {
        // 在測試環境中立即處理
        this.processSyncQueue().catch(console.error);
      }

    } catch (error) {
      console.error('[BackgroundSync] Failed to mark worker for sync:', error);
    }
  }

  /**
   * 處理同步隊列
   */
  async processSyncQueue() {
    try {
      // 獲取待同步的項目
      const pendingItems = await this.dbEngineering.prepare(`
        SELECT * FROM sync_queue 
        WHERE status = 'pending' 
           OR (status = 'failed' AND retry_count < ?)
        ORDER BY created_at ASC
        LIMIT 10
      `).bind(this.maxRetries).all();

      console.log(`[BackgroundSync] Processing ${pendingItems.results.length} items`);

      for (const item of pendingItems.results) {
        await this.processSyncItem(item);
      }

    } catch (error) {
      console.error('[BackgroundSync] Error processing sync queue:', error);
    }
  }

  /**
   * 處理單個同步項目
   */
  async processSyncItem(item) {
    try {
      console.log(`[BackgroundSync] Processing ${item.object_type} ${item.object_id}`);

      let result;
      const updateData = JSON.parse(item.data);

      switch (item.object_type) {
        case 'site':
          result = await this.fxCrmSync.updateSite(item.object_id, updateData);
          break;
        case 'worker':
          if (item.operation === 'update') {
            result = await this.fxCrmSync.updateWorker(item.object_id, updateData);
          } else if (item.operation === 'delete') {
            result = await this.fxCrmSync.deleteWorker(item.object_id);
          }
          break;
        default:
          throw new Error(`Unknown object type: ${item.object_type}`);
      }

      if (result.success) {
        // 同步成功，標記為完成
        await this.dbEngineering.prepare(`
          UPDATE sync_queue 
          SET status = 'completed', 
              completed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(item.id).run();

        console.log(`[BackgroundSync] Successfully synced ${item.object_type} ${item.object_id}`);

      } else {
        throw new Error(result.error || 'Sync failed');
      }

    } catch (error) {
      console.error(`[BackgroundSync] Sync failed for ${item.object_type} ${item.object_id}:`, error);

      // 增加重試次數
      const newRetryCount = item.retry_count + 1;
      
      if (newRetryCount >= this.maxRetries) {
        // 超過最大重試次數，標記為失敗
        await this.dbEngineering.prepare(`
          UPDATE sync_queue 
          SET status = 'failed', 
              error_message = ?,
              retry_count = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(error.message, newRetryCount, item.id).run();

        console.error(`[BackgroundSync] Max retries exceeded for ${item.object_type} ${item.object_id}`);

      } else {
        // 標記為重試，增加延遲
        const nextRetryAt = new Date(Date.now() + this.retryDelay * Math.pow(2, newRetryCount));
        
        await this.dbEngineering.prepare(`
          UPDATE sync_queue 
          SET status = 'pending',
              retry_count = ?,
              error_message = ?,
              next_retry_at = datetime(?),
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          newRetryCount, 
          error.message,
          nextRetryAt.toISOString(),
          item.id
        ).run();

        console.log(`[BackgroundSync] Scheduled retry ${newRetryCount}/${this.maxRetries} for ${item.object_type} ${item.object_id}`);
      }
    }
  }

  /**
   * 清理已完成的同步記錄（保留最近7天）
   */
  async cleanupCompletedSyncs() {
    try {
      const result = await this.dbEngineering.prepare(`
        DELETE FROM sync_queue 
        WHERE status = 'completed' 
          AND completed_at < datetime('now', '-7 days')
      `).run();

      console.log(`[BackgroundSync] Cleaned up ${result.changes} completed sync records`);

    } catch (error) {
      console.error('[BackgroundSync] Error cleaning up sync records:', error);
    }
  }

  /**
   * 獲取同步狀態統計
   */
  async getSyncStats() {
    try {
      const stats = await this.dbEngineering.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM sync_queue 
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY status
      `).all();

      const result = {
        pending: 0,
        completed: 0,
        failed: 0
      };

      for (const row of stats.results) {
        result[row.status] = row.count;
      }

      return result;

    } catch (error) {
      console.error('[BackgroundSync] Error getting sync stats:', error);
      return { pending: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * 手動重試失敗的同步
   */
  async retryFailedSyncs() {
    try {
      await this.dbEngineering.prepare(`
        UPDATE sync_queue 
        SET status = 'pending',
            retry_count = 0,
            error_message = NULL,
            next_retry_at = NULL,
            updated_at = datetime('now')
        WHERE status = 'failed'
      `).run();

      console.log('[BackgroundSync] Reset failed syncs for retry');

      // 立即處理隊列
      await this.processSyncQueue();

    } catch (error) {
      console.error('[BackgroundSync] Error retrying failed syncs:', error);
    }
  }
}