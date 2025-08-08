import { ResponseHelper } from '../utils/response.js';
import { ProjectModel } from '../models/projectModel.js';

/**
 * Project Service - 處理多工程專案邏輯
 */
export class ProjectService {
  constructor(env) {
    this.d1ProxyService = null; // 將在初始化時注入
    this.kv = env.PROJECTS_KV; // 用於儲存專案資料
  }

  /**
   * 設置 D1 代理服務
   */
  setD1ProxyService(d1ProxyService) {
    this.d1ProxyService = d1ProxyService;
  }

  /**
   * 從商機創建專案
   */
  async createProjectFromOpportunity(opportunityId, projectData, userContext) {
    try {
      // 1. 從 CRM 獲取商機資料
      const oppResponse = await this.d1ProxyService.getOpportunity(opportunityId);
      if (!oppResponse.success) {
        return ResponseHelper.error('商機不存在', 404, 'OPPORTUNITY_NOT_FOUND');
      }

      const opportunity = oppResponse.data;

      // 2. 創建專案
      const project = ProjectModel.create({
        opportunityId,
        name: projectData.name || opportunity.opportunity_name,
        companyName: opportunity.company_name,
        admins: projectData.admins || [],
        owners: projectData.owners || [opportunity.contact_id], // 預設商機連絡人為業主
        canCrossView: projectData.canCrossView || false,
        metadata: {
          createdBy: userContext.userId,
          opportunityData: opportunity
        }
      });

      // 3. 儲存專案到 KV
      await this.saveProject(project);

      // 4. 權限只儲存在專案內部，不再傳遞到商機
      
      return ResponseHelper.success({
        project,
        message: '專案創建成功'
      });
    } catch (error) {
      console.error('Create project error:', error);
      return ResponseHelper.error('創建專案失敗', 500, 'CREATE_PROJECT_ERROR');
    }
  }

  /**
   * 添加工程到專案
   */
  async addEngineeringToProject(projectId, engineeringType, engineeringData, userContext) {
    try {
      // 1. 獲取專案
      const project = await this.getProjectById(projectId);
      if (!project) {
        return ResponseHelper.error('專案不存在', 404, 'PROJECT_NOT_FOUND');
      }

      // 2. 檢查權限
      if (userContext.role !== 'admin' && !project.permissions.admins.includes(userContext.userId)) {
        return ResponseHelper.error('無權限添加工程', 403, 'FORBIDDEN');
      }

      // 3. 根據工程類型獲取相關案場
      const sites = await this.getSitesByType(project.opportunityId, engineeringType);

      // 4. 添加工程
      const updatedProject = ProjectModel.addEngineering(project, {
        type: engineeringType,
        name: `${engineeringType}工程`,
        sites: sites.data || [],
        leaders: engineeringData.leaders || [],
        members: engineeringData.members || []
      });

      // 5. 儲存更新
      await this.saveProject(updatedProject);

      // 6. 權限只儲存在專案內部，不再傳遞
      
      return ResponseHelper.success({
        project: updatedProject,
        message: '工程添加成功'
      });
    } catch (error) {
      console.error('Add engineering error:', error);
      return ResponseHelper.error('添加工程失敗', 500, 'ADD_ENGINEERING_ERROR');
    }
  }

  /**
   * 根據工程類型獲取案場
   */
  async getSitesByType(opportunityId, engineeringType) {
    try {
      // 從 CRM 獲取案場資料
      const response = await this.d1ProxyService.getSitesByOpportunity(opportunityId);
      if (!response.success) {
        return { data: [] };
      }

      // 根據類型過濾（這裡假設案場有 type 欄位）
      const sites = response.data.filter(site => {
        // TODO: 根據實際資料結構調整過濾邏輯
        return !engineeringType || site.type === engineeringType;
      });

      // 格式化案場資料
      return {
        data: sites.map(site => ({
          id: site.id,
          building: ProjectModel.normalizeBuilding(site.building),
          floor: site.floor,
          unit: site.unit,
          status: site.status || 'pending',
          construction: {
            floorPlan: site.floor_plan_url,
            beforeNotes: site.before_notes,
            beforePhoto: site.before_photo_url,
            afterPhoto: site.after_photo_url,
            area: site.area,
            date: site.construction_date,
            isCompleted: site.is_completed || false,
            workerName: site.worker_name
          },
          externalDisplayName: site.external_display_name
        }))
      };
    } catch (error) {
      console.error('Get sites by type error:', error);
      return { data: [] };
    }
  }

  /**
   * 獲取專案列表（根據權限）
   */
  async getProjects(userContext, filters = {}) {
    try {
      // 從 KV 獲取所有專案
      const allProjects = await this.getAllProjects();

      // 根據權限過濾
      const accessibleProjects = allProjects.filter(project => 
        ProjectModel.hasAccess(project, userContext.userId, userContext.role)
      );

      // 為每個專案過濾可見的工程
      const filteredProjects = accessibleProjects.map(project => {
        const visibleEngineerings = ProjectModel.filterEngineeringsByPermission(
          project, 
          userContext.userId, 
          userContext.role
        );

        return {
          ...project,
          engineerings: visibleEngineerings,
          // 計算整體進度
          overallProgress: this.calculateOverallProgress(visibleEngineerings)
        };
      });

      // 應用其他過濾條件
      let results = filteredProjects;
      
      if (filters.status) {
        results = results.filter(p => p.status === filters.status);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.companyName.toLowerCase().includes(searchLower)
        );
      }

      return ResponseHelper.success({
        projects: results,
        total: results.length
      });
    } catch (error) {
      console.error('Get projects error:', error);
      return ResponseHelper.error('獲取專案列表失敗', 500, 'GET_PROJECTS_ERROR');
    }
  }

  /**
   * 獲取專案詳情
   */
  async getProjectDetails(projectId, userContext) {
    try {
      const project = await this.getProjectById(projectId);
      
      if (!project) {
        return ResponseHelper.error('專案不存在', 404, 'PROJECT_NOT_FOUND');
      }

      // 檢查存取權限
      if (!ProjectModel.hasAccess(project, userContext.userId, userContext.role)) {
        return ResponseHelper.error('無權限查看此專案', 403, 'FORBIDDEN');
      }

      // 過濾可見的工程
      const visibleEngineerings = ProjectModel.filterEngineeringsByPermission(
        project, 
        userContext.userId, 
        userContext.role
      );

      // 為每個工程組織案場矩陣
      const engineeringsWithMatrix = visibleEngineerings.map(engineering => ({
        ...engineering,
        siteMatrix: ProjectModel.organizeSiteMatrix(engineering.sites)
      }));

      return ResponseHelper.success({
        ...project,
        engineerings: engineeringsWithMatrix
      });
    } catch (error) {
      console.error('Get project details error:', error);
      return ResponseHelper.error('獲取專案詳情失敗', 500, 'GET_PROJECT_DETAILS_ERROR');
    }
  }

  /**
   * 更新案場施工狀態
   */
  async updateSiteConstruction(projectId, engineeringId, siteId, constructionData, userContext) {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) {
        return ResponseHelper.error('專案不存在', 404, 'PROJECT_NOT_FOUND');
      }

      // 檢查權限（工班成員可以更新）
      const engineering = project.engineerings.find(e => e.id === engineeringId);
      if (!engineering) {
        return ResponseHelper.error('工程不存在', 404, 'ENGINEERING_NOT_FOUND');
      }

      const canEdit = userContext.role === 'admin' ||
        engineering.permissions.leaders.includes(userContext.userId) ||
        engineering.permissions.members.includes(userContext.userId);

      if (!canEdit) {
        return ResponseHelper.error('無權限更新施工資料', 403, 'FORBIDDEN');
      }

      // 更新施工資料
      const updatedProject = ProjectModel.updateSiteConstruction(
        project, 
        engineeringId, 
        siteId, 
        {
          ...constructionData,
          workerName: userContext.userName // 記錄施工人員
        }
      );

      if (!updatedProject) {
        return ResponseHelper.error('案場不存在', 404, 'SITE_NOT_FOUND');
      }

      // 儲存更新
      await this.saveProject(updatedProject);

      return ResponseHelper.success({
        message: '施工資料更新成功',
        project: updatedProject
      });
    } catch (error) {
      console.error('Update site construction error:', error);
      return ResponseHelper.error('更新施工資料失敗', 500, 'UPDATE_CONSTRUCTION_ERROR');
    }
  }

  /**
   * 計算整體進度
   */
  calculateOverallProgress(engineerings) {
    if (!engineerings || engineerings.length === 0) return 0;

    const totalSites = engineerings.reduce((sum, eng) => sum + eng.statistics.totalSites, 0);
    const completedSites = engineerings.reduce((sum, eng) => sum + eng.statistics.completedSites, 0);

    return totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;
  }

  // 權限傳遞功能已移除 - 權限只儲存在專案內部

  /**
   * 儲存專案到 KV
   */
  async saveProject(project) {
    const key = `project:${project.id}`;
    await this.kv.put(key, JSON.stringify(project));
  }

  /**
   * 從 KV 獲取專案
   */
  async getProjectById(projectId) {
    const key = `project:${projectId}`;
    const data = await this.kv.get(key, 'json');
    return data;
  }

  /**
   * 獲取所有專案
   */
  async getAllProjects() {
    // TODO: 實作更有效率的列表獲取方式
    // 目前簡化版本，實際應該使用索引或列表
    const list = await this.kv.list({ prefix: 'project:' });
    const projects = [];

    for (const key of list.keys) {
      const project = await this.kv.get(key.name, 'json');
      if (project) {
        projects.push(project);
      }
    }

    return projects;
  }
}