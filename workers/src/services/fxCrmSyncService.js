/**
 * FX CRM 同步服務
 * 負責與 fx-crm-sync API 的所有交互
 */
export class FxCrmSyncService {
  constructor(env) {
    this.env = env;
    this.apiUrl = env.FX_CRM_API_URL || 'https://open.fxiaoke.com';
    this.appId = env.FX_APP_ID || 'FSAID_1320691';
    this.appSecret = env.FX_APP_SECRET || 'ec63ff237c5c4a759be36d3a8fb7a3b4';
    this.permanentCode = env.FX_PERMANENT_CODE || '899433A4A04A3B8CB1CC2183DA4B5B48';
    this.token = env.FX_TOKEN || 'a7e3281a220a4c35ac48f7a1433ca0ea';
    this.defaultTenantId = env.DEFAULT_TENANT_ID || 'default-tenant';
    this.defaultOwnerId = env.DEFAULT_OWNER_ID || 'thread';
    this.corpAccessToken = null;
    this.corpId = null;
    
    console.log('[FxCrmSync] Constructor - Environment variables:', {
      FX_CRM_API_URL: env.FX_CRM_API_URL,
      apiUrl: this.apiUrl,
      appId: this.appId,
      hasSecret: !!env.FX_APP_SECRET,
      hasPermanentCode: !!env.FX_PERMANENT_CODE
    });
  }

  /**
   * 獲取 corpAccessToken 和 corpId
   */
  async getAccessToken() {
    try {
      console.log('[FxCrmSync] Requesting access token from:', `${this.apiUrl}/cgi/corpAccessToken/get/V2`);
      console.log('[FxCrmSync] With credentials:', { appId: this.appId, appSecret: this.appSecret?.substring(0, 8) + '...', permanentCode: this.permanentCode?.substring(0, 8) + '...' });
      
      const response = await fetch(`${this.apiUrl}/cgi/corpAccessToken/get/V2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appId: this.appId,
          appSecret: this.appSecret,
          permanentCode: this.permanentCode
        })
      });

      const result = await response.json();
      console.log('[FxCrmSync] Access token response:', result);
      
      if (result.errorCode !== 0) {
        throw new Error(`Get access token failed: ${result.errorMessage || 'Unknown error'} (${result.errorCode || 'No error code'})`);
      }

      this.corpAccessToken = result.corpAccessToken;
      this.corpId = result.corpId;
      
      console.log('[FxCrmSync] Access token obtained successfully');
      return result;

    } catch (error) {
      console.error('[FxCrmSync] Get access token failed:', error);
      throw error;
    }
  }

  /**
   * 創建工地師父到 CRM（同步操作）
   * 使用紛享銷客標準 API 格式
   */
  async createWorker(workerData) {
    try {
      // 確保有有效的 access token
      if (!this.corpAccessToken) {
        await this.getAccessToken();
      }

      // 確保有有效的 currentOpenUserId
      if (!this.defaultOwnerId || this.defaultOwnerId === 'thread' || this.defaultOwnerId === 'FSUID_1320691') {
        await this.getUserByMobile();
      }

      // 按照紛享銷客自定義對象 API 格式準備資料
      const requestData = {
        corpAccessToken: this.corpAccessToken,
        corpId: this.corpId,
        currentOpenUserId: this.defaultOwnerId,
        data: {
          object_data: {
            dataObjectApiName: "object_50HJ8__c",
            owner: [this.defaultOwnerId],
            name: workerData.name
          },
          details: {},
          needConvertLookup: false
        }
      };

      // 添加選填欄位
      if (workerData.phone) requestData.data.object_data.phone_number__c = workerData.phone;
      if (workerData.abbreviation) requestData.data.object_data.abbreviation__c = workerData.abbreviation;
      if (workerData.password) requestData.data.object_data.password__c = workerData.password;
      if (workerData.account) requestData.data.object_data.account__c = workerData.account;
      if (workerData.lineUserId) requestData.data.object_data.LINE_user_id__c = workerData.lineUserId;
      if (workerData.teamId) requestData.data.object_data.field_D1087__c = workerData.teamId;

      console.log('[FxCrmSync] Creating worker with custom object API format:', requestData);

      // 調用紛享銷客自定義對象 API
      const response = await fetch('https://open.fxiaoke.com/cgi/crm/custom/v2/data/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      console.log('[FxCrmSync] Create worker response:', result);

      // 檢查是否有錯誤
      if (result.errorCode !== undefined && result.errorCode !== 0) {
        throw new Error(`FX CRM API Error: ${result.errorMessage || 'Unknown error'} (${result.errorCode})`);
      }

      // 成功時應該返回 dataId
      if (result.errorCode === 0 && result.dataId) {
        console.log('[FxCrmSync] Worker created successfully:', result);
        return {
          success: true,
          crmId: result.dataId,
          data: result
        };
      }

      // 如果只有 traceId，可能表示成功但沒有返回詳細資料
      if (result.traceId && !result.dataId) {
        console.log('[FxCrmSync] Worker created (trace only):', result);
        return {
          success: true,
          crmId: null,
          data: result,
          note: 'API 回應只包含 traceId，可能需要其他方式獲取記錄 ID'
        };
      }

      console.log('[FxCrmSync] Worker created successfully:', result);
      return {
        success: true,
        crmId: result.dataId,
        data: result
      };

    } catch (error) {
      console.error('[FxCrmSync] Create worker failed:', error);
      throw error;
    }
  }

  /**
   * 更新案場資料到 CRM（異步操作）
   * 流程：背景調用，不阻塞主流程
   */
  async updateSite(siteId, updateData) {
    try {
      // 對應案場欄位到 CRM 欄位
      const crmUpdateData = {};
      
      // 工班相關
      if (updateData.shift_time !== undefined) crmUpdateData.shift_time__c = updateData.shift_time;
      if (updateData.worker_name !== undefined) crmUpdateData.field_u1wpv__c = updateData.worker_name;
      
      // 施工相關
      if (updateData.construction_date !== undefined) crmUpdateData.field_23pFq__c = updateData.construction_date;
      if (updateData.completed !== undefined) crmUpdateData.construction_completed__c = updateData.completed;
      if (updateData.completion_notes !== undefined) crmUpdateData.work_shift_completion_note__c = updateData.completion_notes;
      
      // 照片相關
      if (updateData.before_photo_url !== undefined) crmUpdateData.field_V3d91__c = updateData.before_photo_url;
      if (updateData.after_photo_url !== undefined) crmUpdateData.field_3Fqof__c = updateData.after_photo_url;
      if (updateData.inspection_photo_url !== undefined) crmUpdateData.field_v1x3S__c = updateData.inspection_photo_url;
      if (updateData.before_condition_photo !== undefined) crmUpdateData.field_03U9h__c = updateData.before_condition_photo;
      if (updateData.after_condition_photo !== undefined) crmUpdateData.construction_difficulty_ph__c = updateData.after_condition_photo;
      
      // 狀態與階段
      if (updateData.stage !== undefined) crmUpdateData.field_z9H6O__c = updateData.stage;
      if (updateData.tags !== undefined) crmUpdateData.field_23Z5i__c = updateData.tags;
      if (updateData.site_type !== undefined) crmUpdateData.field_dxr31__c = updateData.site_type;
      
      // 備註相關
      if (updateData.before_notes !== undefined) crmUpdateData.field_sF6fn__c = updateData.before_notes;
      if (updateData.site_notes !== undefined) crmUpdateData.field_g18hX__c = updateData.site_notes;
      if (updateData.inspection_notes !== undefined) crmUpdateData.field_n37jC__c = updateData.inspection_notes;
      
      // 案場基本資訊
      if (updateData.building !== undefined) crmUpdateData.field_WD7k1__c = updateData.building;
      if (updateData.floor !== undefined) crmUpdateData.field_Q6Svh__c = updateData.floor;
      if (updateData.unit !== undefined) crmUpdateData.field_XuJP2__c = updateData.unit;
      if (updateData.site_area !== undefined) crmUpdateData.field_tXAko__c = updateData.site_area;
      if (updateData.construction_area !== undefined) crmUpdateData.field_B2gh1__c = updateData.construction_area;
      if (updateData.protection_area !== undefined) crmUpdateData.field_27g6n__c = updateData.protection_area;

      console.log('[FxCrmSync] Updating site in CRM:', siteId, crmUpdateData);

      // 調用 CRM API 更新
      const response = await fetch(`${this.apiUrl}/api/crud/object_8W9cb__c/${siteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: JSON.stringify(crmUpdateData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(`CRM API Error: ${result.error || result.message}`);
      }

      console.log('[FxCrmSync] Site updated successfully:', result.data);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('[FxCrmSync] Update site failed:', error);
      throw error;
    }
  }

  /**
   * 批量更新案場（背景同步用）
   */
  async batchUpdateSites(updates) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const { siteId, updateData } of updates) {
      try {
        await this.updateSite(siteId, updateData);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          siteId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 更新工地師父資料到 CRM（異步操作）
   */
  async updateWorker(workerId, updateData) {
    try {
      // 對應工地師父欄位到 CRM 欄位
      const crmUpdateData = {};
      
      if (updateData.name !== undefined) crmUpdateData.name = updateData.name;
      if (updateData.phone !== undefined) crmUpdateData.phone_number__c = updateData.phone;
      if (updateData.abbreviation !== undefined) crmUpdateData.abbreviation__c = updateData.abbreviation;
      if (updateData.password !== undefined) crmUpdateData.password__c = updateData.password;
      if (updateData.account !== undefined) crmUpdateData.account__c = updateData.account;
      if (updateData.line_user_id !== undefined) crmUpdateData.LINE_user_id__c = updateData.line_user_id;
      if (updateData.team_id !== undefined) crmUpdateData.field_D1087__c = updateData.team_id;
      if (updateData.avatar_url !== undefined) crmUpdateData.field_Imtt7__c = updateData.avatar_url;

      console.log('[FxCrmSync] Updating worker in CRM:', workerId, crmUpdateData);

      // 調用 CRM API 更新
      const response = await fetch(`${this.apiUrl}/api/crud/object_50HJ8__c/${workerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: JSON.stringify(crmUpdateData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(`CRM API Error: ${result.error || result.message}`);
      }

      console.log('[FxCrmSync] Worker updated successfully:', result.data);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('[FxCrmSync] Update worker failed:', error);
      throw error;
    }
  }

  /**
   * 刪除工地師父（標記為作廢）
   */
  async deleteWorker(workerId) {
    try {
      console.log('[FxCrmSync] Deleting worker in CRM:', workerId);

      // CRM 中通常是標記為作廢而非真正刪除
      const response = await fetch(`${this.apiUrl}/api/crud/object_50HJ8__c/${workerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: JSON.stringify({
          life_status: '作废'
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(`CRM API Error: ${result.error || result.message}`);
      }

      console.log('[FxCrmSync] Worker deleted successfully:', result.data);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('[FxCrmSync] Delete worker failed:', error);
      throw error;
    }
  }

  /**
   * 通過手機號獲取用戶的 openUserId
   */
  async getUserByMobile(mobile = "17675662629") {
    try {
      if (!this.corpAccessToken) {
        await this.getAccessToken();
      }

      const response = await fetch(`${this.apiUrl}/cgi/user/getByMobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          corpId: this.corpId,
          corpAccessToken: this.corpAccessToken,
          mobile: mobile
        })
      });

      const result = await response.json();
      
      if (result.errorCode !== 0) {
        throw new Error(`Get user by mobile failed: ${result.errorMessage} (${result.errorCode})`);
      }

      console.log('[FxCrmSync] Got user by mobile:', result.empList?.length || 0, 'users');
      
      // 使用第一個用戶的 openUserId
      if (result.empList && result.empList.length > 0) {
        this.defaultOwnerId = result.empList[0].openUserId;
        console.log('[FxCrmSync] Updated default owner ID:', this.defaultOwnerId);
        return this.defaultOwnerId;
      }

      return null;

    } catch (error) {
      console.error('[FxCrmSync] Get user by mobile failed:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶列表
   */
  async getUserList() {
    try {
      if (!this.corpAccessToken) {
        await this.getAccessToken();
      }

      const response = await fetch(`${this.apiUrl}/cgi/user/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          corpId: this.corpId,
          corpAccessToken: this.corpAccessToken,
          showDimission: false
        })
      });

      const result = await response.json();
      
      if (result.errorCode !== 0) {
        throw new Error(`Get user list failed: ${result.errorMessage} (${result.errorCode})`);
      }

      console.log('[FxCrmSync] Got user list:', result.userList?.length || 0, 'users');
      return result.userList || [];

    } catch (error) {
      console.error('[FxCrmSync] Get user list failed:', error);
      throw error;
    }
  }

  /**
   * 檢查 CRM API 狀態
   */
  async healthCheck() {
    try {
      // 測試是否能獲取 access token
      const tokenResult = await this.getAccessToken();
      if (tokenResult && tokenResult.errorCode === 0) {
        // 獲取有效的 currentOpenUserId
        const openUserId = await this.getUserByMobile();
        return !!openUserId;
      }
      return false;
    } catch (error) {
      console.error('[FxCrmSync] Health check failed:', error);
      return false;
    }
  }
}