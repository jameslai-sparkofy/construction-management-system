import { ResponseHelper } from '../utils/response.js';

/**
 * Sites Routes - 處理案場相關的 API 請求
 * 案場資料存在 CRM 資料庫中
 */
export class SitesRoutes {
  constructor(dualDatabaseService) {
    this.dualDatabaseService = dualDatabaseService;
  }

  /**
   * 獲取專案的所有案場
   */
  async getSitesByProject(request, params) {
    try {
      const { projectId } = params;
      
      // 從工程管理資料庫獲取專案資料
      const projectResult = await this.dualDatabaseService.getProject(projectId);
      if (!projectResult.success) {
        return ResponseHelper.error('專案不存在', 404);
      }

      const project = projectResult.data;
      
      // 從 CRM 資料庫獲取案場資料
      const [spcSites, cabinetSites] = await Promise.all([
        project.spc_engineering?.enabled 
          ? this.dualDatabaseService.getCRMSites(project.opportunity_id, 'SPC')
          : { data: [] },
        project.cabinet_engineering?.enabled 
          ? this.dualDatabaseService.getCRMSites(project.opportunity_id, 'CABINET')
          : { data: [] }
      ]);

      // 從工程管理資料庫獲取施工進度
      const progressData = await this.dualDatabaseService.getConstructionProgress(projectId);

      // 整合案場資料與施工進度
      const sites = [
        ...spcSites.data.map(site => ({
          ...site,
          engineering_type: 'SPC',
          progress: progressData.data.find(p => 
            p.site_id === site.id && p.engineering_type === 'SPC'
          ) || null
        })),
        ...cabinetSites.data.map(site => ({
          ...site,
          engineering_type: 'CABINET',
          progress: progressData.data.find(p => 
            p.site_id === site.id && p.engineering_type === 'CABINET'
          ) || null
        }))
      ];

      return ResponseHelper.success({
        project_id: projectId,
        sites: sites.map(site => this.formatSiteData(site))
      });
    } catch (error) {
      console.error('Get sites error:', error);
      return ResponseHelper.error('獲取案場失敗', 500);
    }
  }

  /**
   * 獲取單一案場詳情
   */
  async getSiteDetails(request, params) {
    try {
      const { projectId, siteId } = params;
      const url = new URL(request.url);
      const engineeringType = url.searchParams.get('type') || 'SPC';

      // 從 CRM 獲取案場資料
      const siteResult = await this.dualDatabaseService.getCRMSiteById(siteId, engineeringType);
      if (!siteResult.success) {
        return ResponseHelper.error('案場不存在', 404);
      }

      // 從工程管理資料庫獲取施工進度
      const progressResult = await this.dualDatabaseService.getConstructionProgressBySite(
        projectId, 
        siteId, 
        engineeringType
      );

      const site = {
        ...siteResult.data,
        engineering_type: engineeringType,
        progress: progressResult.data || null
      };

      return ResponseHelper.success(this.formatSiteData(site));
    } catch (error) {
      console.error('Get site details error:', error);
      return ResponseHelper.error('獲取案場詳情失敗', 500);
    }
  }

  /**
   * 更新案場施工進度
   */
  async updateSiteProgress(request, params) {
    try {
      const { projectId, siteId } = params;
      const body = await request.json();
      
      // 驗證權限（從 request header 獲取用戶資訊）
      const userId = request.headers.get('X-User-Id');
      if (!userId) {
        return ResponseHelper.error('未授權', 401);
      }

      // 準備施工進度資料
      const progressData = {
        projectId,
        siteId,
        engineeringType: body.engineering_type || 'SPC',
        status: body.status,
        beforePhotoUrl: body.before_photo_url,
        afterPhotoUrl: body.after_photo_url,
        constructionArea: body.construction_area,
        constructionDate: body.construction_date,
        workerId: userId,
        workerName: body.worker_name,
        notes: body.notes,
        externalDisplayName: body.external_display_name
      };

      // 更新施工進度到工程管理資料庫
      const result = await this.dualDatabaseService.updateConstructionProgress(progressData);
      
      if (!result.success) {
        return result;
      }

      // 如果需要更新 CRM 中的案場狀態
      if (body.update_crm) {
        await this.updateCRMSiteStatus(siteId, body.engineering_type, body.status);
      }

      return ResponseHelper.success({
        message: '施工進度更新成功',
        site_id: siteId,
        project_id: projectId
      });
    } catch (error) {
      console.error('Update site progress error:', error);
      return ResponseHelper.error('更新施工進度失敗', 500);
    }
  }

  /**
   * 上傳施工照片
   */
  async uploadConstructionPhoto(request, params) {
    try {
      const { projectId, siteId } = params;
      
      // 獲取上傳的檔案
      const formData = await request.formData();
      const file = formData.get('photo');
      const photoType = formData.get('type'); // 'before' or 'after'
      
      if (!file) {
        return ResponseHelper.error('請選擇要上傳的照片', 400);
      }

      // 生成檔案名稱
      const fileName = `${projectId}/${siteId}/${photoType}_${Date.now()}_${file.name}`;
      
      // 上傳到 R2
      const uploadResult = await this.dualDatabaseService.uploadToR2(fileName, file);
      
      if (!uploadResult.success) {
        return ResponseHelper.error('照片上傳失敗', 500);
      }

      return ResponseHelper.success({
        url: uploadResult.url,
        filename: fileName
      });
    } catch (error) {
      console.error('Upload photo error:', error);
      return ResponseHelper.error('照片上傳失敗', 500);
    }
  }

  /**
   * 格式化案場資料
   */
  formatSiteData(site) {
    return {
      id: site.id || site._id,
      opportunity_id: site.field_8eM2Z__c || site.opportunity_id,
      engineering_type: site.engineering_type,
      name: site.name,
      building: site.building || 'A', // NULL 當作 A 棟
      floor: site.floor,
      unit: site.unit,
      area: site.area,
      status: site.progress?.status || 'pending',
      construction: {
        status: site.progress?.status || 'pending',
        before_photo_url: site.progress?.before_photo_url,
        after_photo_url: site.progress?.after_photo_url,
        construction_area: site.progress?.construction_area || site.area,
        construction_date: site.progress?.construction_date,
        worker_name: site.progress?.worker_name,
        notes: site.progress?.notes,
        external_display_name: site.progress?.external_display_name
      },
      created_at: site.created_at,
      updated_at: site.progress?.updated_at || site.updated_at
    };
  }

  /**
   * 更新 CRM 中的案場狀態
   */
  async updateCRMSiteStatus(siteId, engineeringType, status) {
    try {
      // 準備更新資料
      const updateData = {
        construction_status: status,
        last_update: new Date().toISOString()
      };

      // 透過 CRUD API 更新案場
      const table = engineeringType === 'CABINET' ? 'site_cabinet_c' : 'object_8w9cb__c';
      const result = await this.dualDatabaseService.updateCRMRecord(table, siteId, updateData);
      
      return result;
    } catch (error) {
      console.error('Update CRM site status error:', error);
      // 不影響主要流程
      return { success: false };
    }
  }

  /**
   * 設定路由
   */
  setupRoutes(router) {
    // 獲取專案的所有案場
    router.get('/api/v1/projects/:projectId/sites', (request, params) => 
      this.getSitesByProject(request, params)
    );

    // 獲取單一案場詳情
    router.get('/api/v1/projects/:projectId/sites/:siteId', (request, params) => 
      this.getSiteDetails(request, params)
    );

    // 更新案場施工進度
    router.put('/api/v1/projects/:projectId/sites/:siteId/progress', (request, params) => 
      this.updateSiteProgress(request, params)
    );

    // 上傳施工照片
    router.post('/api/v1/projects/:projectId/sites/:siteId/photo', (request, params) => 
      this.uploadConstructionPhoto(request, params)
    );
  }
}