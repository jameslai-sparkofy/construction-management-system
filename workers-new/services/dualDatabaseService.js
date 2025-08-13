import { ResponseHelper } from '../utils/response.js';

/**
 * Dual Database Service
 * 管理兩個 D1 資料庫的存取：
 * 1. DB_CRM (fx-crm-database) - CRM 同步資料（綠色區塊）
 * 2. DB_ENGINEERING (engineering-management) - 專案管理資料（白色區塊）
 */
export class DualDatabaseService {
  constructor(env) {
    // CRM 資料庫 - 透過 REST API 存取
    this.crmApiUrl = env.API_BASE_URL;
    this.crmApiToken = env.REST_API_TOKEN;
    
    // 工程管理資料庫 - 直接 D1 存取
    this.dbEngineering = env.DB_ENGINEERING;
    
    // KV 儲存
    this.sessionsKV = env.SESSIONS;
    this.usersKV = env.USERS;
    this.filesKV = env.FILES_KV;
  }

  // ============ CRM 資料庫操作 (透過 REST API) ============

  /**
   * 從 CRM 獲取商機資料
   */
  async getCRMOpportunity(opportunityId) {
    try {
      const response = await fetch(
        `${this.crmApiUrl}/rest/newopportunityobj/${opportunityId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return ResponseHelper.success(data.results?.[0] || null);
    } catch (error) {
      console.error('Get CRM opportunity error:', error);
      return ResponseHelper.error('獲取商機失敗', 500, 'CRM_API_ERROR');
    }
  }

  /**
   * 從 CRM 獲取案場資料
   */
  async getCRMSites(opportunityId, type = 'SPC') {
    try {
      // 根據類型選擇不同的資料表
      const table = type === 'CABINET' ? 'site_cabinet_c' : 'object_8w9cb__c';
      
      // 注意：商機關聯欄位可能是 field_k7e6q__c (建案) 而非直接的商機ID
      // 需要根據實際資料結構調整查詢條件
      const response = await fetch(
        `${this.crmApiUrl}/rest/${table}?limit=500`,
        {
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      const sites = data.results || [];
      
      // 過濾出與商機相關的案場（透過建案關聯）
      // TODO: 需要確認商機與案場的關聯邏輯
      const filteredSites = sites.filter(site => {
        // 暫時返回所有案場，實際需要根據商機關聯過濾
        return true;
      });
      
      return ResponseHelper.success(filteredSites);
    } catch (error) {
      console.error('Get CRM sites error:', error);
      return ResponseHelper.error('獲取案場失敗', 500, 'CRM_API_ERROR');
    }
  }

  /**
   * 從 CRM 獲取單一案場資料
   */
  async getCRMSiteById(siteId, type = 'SPC') {
    try {
      const table = type === 'CABINET' ? 'site_cabinet_c' : 'object_8w9cb__c';
      
      const response = await fetch(
        `${this.crmApiUrl}/rest/${table}/${siteId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return ResponseHelper.success(data.results?.[0] || null);
    } catch (error) {
      console.error('Get CRM site by ID error:', error);
      return ResponseHelper.error('獲取案場失敗', 500, 'CRM_API_ERROR');
    }
  }

  /**
   * 更新 CRM 案場資料
   */
  async updateCRMSite(siteId, type = 'SPC', updateData) {
    try {
      const table = type === 'CABINET' ? 'site_cabinet_c' : 'object_8w9cb__c';
      
      // 使用 CRUD API 更新案場
      const response = await fetch(
        `${this.crmApiUrl}/crud/${table}/${siteId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return ResponseHelper.success(data);
    } catch (error) {
      console.error('Update CRM site error:', error);
      return ResponseHelper.error('更新案場失敗', 500, 'CRM_API_ERROR');
    }
  }

  /**
   * 從 CRM 獲取維修單
   */
  async getCRMMaintenanceOrders(projectId) {
    try {
      const response = await fetch(
        `${this.crmApiUrl}/rest/object_k1XqG__c?project_id=${projectId}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return ResponseHelper.success(data.results || []);
    } catch (error) {
      console.error('Get CRM maintenance orders error:', error);
      return ResponseHelper.error('獲取維修單失敗', 500, 'CRM_API_ERROR');
    }
  }

  /**
   * 從 CRM 獲取進度管理公告
   */
  async getCRMAnnouncements(projectId) {
    try {
      const response = await fetch(
        `${this.crmApiUrl}/rest/progress_management_announ_c?project_id=${projectId}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return ResponseHelper.success(data.results || []);
    } catch (error) {
      console.error('Get CRM announcements error:', error);
      return ResponseHelper.error('獲取公告失敗', 500, 'CRM_API_ERROR');
    }
  }

  /**
   * 從 CRM 獲取工地師父資料
   */
  async getCRMWorkers() {
    try {
      const response = await fetch(
        `${this.crmApiUrl}/rest/object_50HJ8__c?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.crmApiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return ResponseHelper.success(data.results || []);
    } catch (error) {
      console.error('Get CRM workers error:', error);
      return ResponseHelper.error('獲取工地師父失敗', 500, 'CRM_API_ERROR');
    }
  }

  // ============ 工程管理資料庫操作 (直接 D1) ============

  /**
   * 創建專案
   */
  async createProject(projectData) {
    try {
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const stmt = await this.dbEngineering.prepare(`
        INSERT INTO projects (
          id, opportunity_id, name, 
          spc_engineering, cabinet_engineering, 
          maintenance, progress_management,
          permissions, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        projectId,
        projectData.opportunityId,
        projectData.name,
        JSON.stringify(projectData.spcEngineering || {}),
        JSON.stringify(projectData.cabinetEngineering || {}),
        JSON.stringify(projectData.maintenance || {}),
        JSON.stringify(projectData.progressManagement || {}),
        JSON.stringify(projectData.permissions || {}),
        projectData.status || 'active',
        projectData.createdBy
      ).run();

      return ResponseHelper.success({
        id: projectId,
        message: '專案創建成功'
      });
    } catch (error) {
      console.error('Create project error:', error);
      return ResponseHelper.error('創建專案失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 獲取專案
   */
  async getProject(projectId) {
    try {
      const project = await this.dbEngineering.prepare(`
        SELECT * FROM projects WHERE id = ?
      `).bind(projectId).first();

      if (!project) {
        return ResponseHelper.error('專案不存在', 404, 'PROJECT_NOT_FOUND');
      }

      // 解析 JSON 欄位
      project.spc_engineering = JSON.parse(project.spc_engineering || '{}');
      project.cabinet_engineering = JSON.parse(project.cabinet_engineering || '{}');
      project.maintenance = JSON.parse(project.maintenance || '{}');
      project.progress_management = JSON.parse(project.progress_management || '{}');
      project.permissions = JSON.parse(project.permissions || '{}');

      return ResponseHelper.success(project);
    } catch (error) {
      console.error('Get project error:', error);
      return ResponseHelper.error('獲取專案失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 創建或更新使用者
   */
  async upsertUser(userData) {
    try {
      const userId = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.dbEngineering.prepare(`
        INSERT INTO users (
          id, phone, password_suffix, name, email, role, user_projects
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
          name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          user_projects = excluded.user_projects,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        userId,
        userData.phone,
        userData.phone.slice(-3), // 手機末3碼作為密碼
        userData.name,
        userData.email,
        userData.role || 'member',
        JSON.stringify(userData.projects || [])
      ).run();

      return ResponseHelper.success({
        id: userId,
        message: '使用者更新成功'
      });
    } catch (error) {
      console.error('Upsert user error:', error);
      return ResponseHelper.error('更新使用者失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 驗證使用者登入
   */
  async authenticateUser(phone, password) {
    try {
      const user = await this.dbEngineering.prepare(`
        SELECT * FROM users WHERE phone = ? AND password_suffix = ?
      `).bind(phone, password).first();

      if (!user) {
        // 記錄失敗的登入
        await this.dbEngineering.prepare(`
          INSERT INTO login_logs (phone, success, error_message)
          VALUES (?, 0, 'Invalid credentials')
        `).bind(phone).run();

        return ResponseHelper.error('手機號碼或密碼錯誤', 401, 'INVALID_CREDENTIALS');
      }

      // 記錄成功的登入
      await this.dbEngineering.prepare(`
        INSERT INTO login_logs (user_id, phone, success)
        VALUES (?, ?, 1)
      `).bind(user.id, phone).run();

      // 更新最後登入時間
      await this.dbEngineering.prepare(`
        UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(user.id).run();

      // 解析 JSON 欄位
      user.user_projects = JSON.parse(user.user_projects || '[]');

      return ResponseHelper.success(user);
    } catch (error) {
      console.error('Authenticate user error:', error);
      return ResponseHelper.error('登入失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 設定專案權限
   */
  async setProjectPermission(projectId, userId, role, engineeringType = 'ALL') {
    try {
      await this.dbEngineering.prepare(`
        INSERT INTO project_permissions (
          project_id, user_id, role, engineering_type, can_edit, can_view_others
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, user_id, engineering_type) DO UPDATE SET
          role = excluded.role,
          can_edit = excluded.can_edit,
          can_view_others = excluded.can_view_others
      `).bind(
        projectId,
        userId,
        role,
        engineeringType,
        role === 'admin' || role === 'leader' ? 1 : 0,
        role === 'admin' || role === 'owner' ? 1 : 0
      ).run();

      return ResponseHelper.success({
        message: '權限設定成功'
      });
    } catch (error) {
      console.error('Set project permission error:', error);
      return ResponseHelper.error('設定權限失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 獲取專案的施工進度
   */
  async getConstructionProgress(projectId) {
    try {
      const progress = await this.dbEngineering.prepare(`
        SELECT * FROM construction_progress WHERE project_id = ?
      `).bind(projectId).all();

      return ResponseHelper.success(progress.results || []);
    } catch (error) {
      console.error('Get construction progress error:', error);
      return ResponseHelper.error('獲取施工進度失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 獲取單一案場的施工進度
   */
  async getConstructionProgressBySite(projectId, siteId, engineeringType) {
    try {
      const progress = await this.dbEngineering.prepare(`
        SELECT * FROM construction_progress 
        WHERE project_id = ? AND site_id = ? AND engineering_type = ?
      `).bind(projectId, siteId, engineeringType).first();

      return ResponseHelper.success(progress);
    } catch (error) {
      console.error('Get site construction progress error:', error);
      return ResponseHelper.error('獲取案場施工進度失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 更新施工進度
   */
  async updateConstructionProgress(progressData) {
    try {
      const existing = await this.dbEngineering.prepare(`
        SELECT id FROM construction_progress 
        WHERE project_id = ? AND site_id = ? AND engineering_type = ?
      `).bind(
        progressData.projectId,
        progressData.siteId,
        progressData.engineeringType
      ).first();

      if (existing) {
        // 更新現有記錄
        await this.dbEngineering.prepare(`
          UPDATE construction_progress SET
            status = ?,
            before_photo_url = ?,
            after_photo_url = ?,
            construction_area = ?,
            construction_date = ?,
            worker_name = ?,
            notes = ?,
            external_display_name = ?
          WHERE id = ?
        `).bind(
          progressData.status,
          progressData.beforePhotoUrl,
          progressData.afterPhotoUrl,
          progressData.constructionArea,
          progressData.constructionDate,
          progressData.workerName,
          progressData.notes,
          progressData.externalDisplayName,
          existing.id
        ).run();
      } else {
        // 插入新記錄
        await this.dbEngineering.prepare(`
          INSERT INTO construction_progress (
            project_id, site_id, engineering_type, status,
            before_photo_url, after_photo_url, construction_area,
            construction_date, worker_id, worker_name, notes,
            external_display_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          progressData.projectId,
          progressData.siteId,
          progressData.engineeringType,
          progressData.status || 'pending',
          progressData.beforePhotoUrl,
          progressData.afterPhotoUrl,
          progressData.constructionArea,
          progressData.constructionDate,
          progressData.workerId,
          progressData.workerName,
          progressData.notes,
          progressData.externalDisplayName
        ).run();
      }

      // 記錄活動
      await this.logActivity(
        progressData.projectId,
        progressData.workerId,
        'update',
        'construction',
        progressData.siteId,
        `更新施工進度：${progressData.status}`
      );

      return ResponseHelper.success({
        message: '施工進度更新成功'
      });
    } catch (error) {
      console.error('Update construction progress error:', error);
      return ResponseHelper.error('更新施工進度失敗', 500, 'DB_ERROR');
    }
  }

  /**
   * 記錄專案活動
   */
  async logActivity(projectId, userId, activityType, targetType, targetId, description) {
    try {
      await this.dbEngineering.prepare(`
        INSERT INTO project_activities (
          project_id, user_id, activity_type, target_type, target_id, description
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        projectId,
        userId,
        activityType,
        targetType,
        targetId,
        description
      ).run();
    } catch (error) {
      console.error('Log activity error:', error);
    }
  }

  /**
   * 獲取專案的完整資料（結合兩個資料庫）
   */
  async getProjectFullData(projectId, userId) {
    try {
      // 1. 從工程管理資料庫獲取專案
      const projectResult = await this.getProject(projectId);
      if (!projectResult.success) {
        return projectResult;
      }

      const project = projectResult.data;

      // 2. 從 CRM 資料庫獲取商機
      const opportunityResult = await this.getCRMOpportunity(project.opportunity_id);
      
      // 3. 從 CRM 資料庫獲取相關資料
      const [spcSites, cabinetSites, maintenanceOrders, announcements] = await Promise.all([
        project.spc_engineering.enabled ? this.getCRMSites(project.opportunity_id, 'SPC') : { data: [] },
        project.cabinet_engineering.enabled ? this.getCRMSites(project.opportunity_id, 'CABINET') : { data: [] },
        this.getCRMMaintenanceOrders(projectId),
        this.getCRMAnnouncements(projectId)
      ]);

      // 4. 從工程管理資料庫獲取施工進度
      const progress = await this.dbEngineering.prepare(`
        SELECT * FROM construction_progress WHERE project_id = ?
      `).bind(projectId).all();

      // 5. 格式化案場資料，確保棟別正確處理
      const formatSites = (sites, engineeringType) => {
        return sites.map(site => ({
          id: site._id || site.id,
          name: site.name,
          building: site.field_WD7k1__c || 'A',  // 棟別，NULL當作A
          floor: site.field_npLvn__c__r || site.floor,  // 樓層
          unit: site.field_XuJP2__c || site.unit,  // 戶別
          area: site.field_Q6Svh__c || site.field_i2Q1g__c || site.area,  // 面積/坪數
          status: site.field_23Z5i__c__r || '準備中',  // 狀態
          type: site.field_dxr31__c__r || '工地',  // 類型
          engineering_type: engineeringType,
          // 找出對應的施工進度
          progress: progress.results.find(p => 
            p.site_id === (site._id || site.id) && 
            p.engineering_type === engineeringType
          ) || null
        }));
      };

      // 6. 組合資料
      return ResponseHelper.success({
        project,
        opportunity: opportunityResult.data,
        engineerings: {
          spc: {
            enabled: project.spc_engineering.enabled,
            sites: formatSites(spcSites.data, 'SPC'),
            totalSites: spcSites.data.length
          },
          cabinet: {
            enabled: project.cabinet_engineering.enabled,
            sites: formatSites(cabinetSites.data, 'CABINET'),
            totalSites: cabinetSites.data.length
          }
        },
        maintenanceOrders: maintenanceOrders.data,
        announcements: announcements.data
      });
    } catch (error) {
      console.error('Get project full data error:', error);
      return ResponseHelper.error('獲取專案完整資料失敗', 500, 'GET_FULL_DATA_ERROR');
    }
  }
}