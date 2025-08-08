/**
 * Project Model - 支援多工程架構
 * 一個專案可以包含多個工程類型（SPC、浴櫃等）
 */

export class ProjectModel {
  /**
   * 專案結構
   * @typedef {Object} Project
   * @property {string} id - 專案ID
   * @property {string} opportunityId - 關聯的商機ID
   * @property {string} name - 專案名稱
   * @property {string} companyName - 公司名稱
   * @property {string} status - 專案狀態 (active/completed/pending)
   * @property {Array<ProjectEngineering>} engineerings - 工程列表
   * @property {ProjectPermissions} permissions - 權限設定
   * @property {Object} metadata - 其他元資料
   * @property {Date} createdAt - 創建時間
   * @property {Date} updatedAt - 更新時間
   */

  /**
   * 工程結構（SPC、浴櫃等）
   * @typedef {Object} ProjectEngineering
   * @property {string} id - 工程ID
   * @property {string} type - 工程類型 (SPC/CABINET/其他)
   * @property {string} name - 工程名稱
   * @property {Array<Site>} sites - 案場列表
   * @property {Array<MaintenanceOrder>} maintenanceOrders - 維修單列表
   * @property {Array<Announcement>} announcements - 公告列表
   * @property {EngineeringPermissions} permissions - 工程權限
   * @property {Object} statistics - 統計資料
   * @property {number} statistics.totalSites - 總案場數
   * @property {number} statistics.completedSites - 完成案場數
   * @property {number} statistics.progress - 進度百分比
   */

  /**
   * 案場結構
   * @typedef {Object} Site
   * @property {string} id - 案場ID (來自 object_8w9cb__c)
   * @property {string} building - 棟別 (A/B/C/null當作A)
   * @property {string} floor - 樓層
   * @property {string} unit - 戶別
   * @property {string} status - 狀態 (pending/in_progress/completed)
   * @property {Object} construction - 施工資料
   * @property {string} construction.floorPlan - 平面圖URL
   * @property {string} construction.beforeNotes - 施工前備註
   * @property {string} construction.beforePhoto - 施工前照片URL
   * @property {string} construction.afterPhoto - 施工後照片URL
   * @property {number} construction.area - 鋪設坪數
   * @property {Date} construction.date - 施工日期
   * @property {boolean} construction.isCompleted - 是否完成
   * @property {string} construction.workerName - 施工人員姓名
   * @property {string} externalDisplayName - 外部顯示名稱（管理員備註）
   */

  /**
   * 權限結構
   * @typedef {Object} ProjectPermissions
   * @property {Array<string>} admins - 管理員列表
   * @property {Array<string>} owners - 業主列表（商機連絡人）
   * @property {boolean} canCrossView - 工班是否可以看到其他工班進度
   */

  /**
   * 工程權限結構
   * @typedef {Object} EngineeringPermissions
   * @property {Array<string>} leaders - 工班負責人列表
   * @property {Array<string>} members - 工班成員列表
   */

  /**
   * 創建新專案
   */
  static create(data) {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: projectId,
      opportunityId: data.opportunityId,
      name: data.name,
      companyName: data.companyName,
      status: 'active',
      engineerings: [],
      permissions: {
        admins: data.admins || [],
        owners: data.owners || [],
        canCrossView: data.canCrossView || false
      },
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 添加工程到專案
   */
  static addEngineering(project, engineeringData) {
    const engineeringId = `eng_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const engineering = {
      id: engineeringId,
      type: engineeringData.type, // SPC or CABINET
      name: engineeringData.name || `${engineeringData.type}工程`,
      sites: engineeringData.sites || [],
      maintenanceOrders: [],
      announcements: [],
      permissions: {
        leaders: engineeringData.leaders || [],
        members: engineeringData.members || []
      },
      statistics: this.calculateStatistics(engineeringData.sites || [])
    };

    project.engineerings.push(engineering);
    project.updatedAt = new Date().toISOString();
    
    return project;
  }

  /**
   * 計算工程統計資料
   */
  static calculateStatistics(sites) {
    const totalSites = sites.length;
    const completedSites = sites.filter(s => s.status === 'completed').length;
    const progress = totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;

    return {
      totalSites,
      completedSites,
      progress
    };
  }

  /**
   * 處理棟別（NULL當作A棟）
   */
  static normalizeBuilding(building) {
    return building || 'A';
  }

  /**
   * 根據權限過濾工程
   */
  static filterEngineeringsByPermission(project, userId, userRole) {
    // 管理員和業主看到全部
    if (userRole === 'admin' || project.permissions.owners.includes(userId)) {
      return project.engineerings;
    }

    // 工班只看到自己參與的工程
    return project.engineerings.filter(eng => {
      return eng.permissions.leaders.includes(userId) || 
             eng.permissions.members.includes(userId);
    });
  }

  /**
   * 檢查使用者是否有專案存取權限
   */
  static hasAccess(project, userId, userRole) {
    // 管理員總是有權限
    if (userRole === 'admin') return true;

    // 業主有權限
    if (project.permissions.owners.includes(userId)) return true;

    // 檢查是否在任何工程中
    return project.engineerings.some(eng => {
      return eng.permissions.leaders.includes(userId) || 
             eng.permissions.members.includes(userId);
    });
  }

  /**
   * 組織案場資料為樓層圖矩陣
   */
  static organizeSiteMatrix(sites) {
    // 按棟別分組
    const buildingGroups = {};
    
    sites.forEach(site => {
      const building = this.normalizeBuilding(site.building);
      if (!buildingGroups[building]) {
        buildingGroups[building] = [];
      }
      buildingGroups[building].push(site);
    });

    // 為每個棟別建立樓層矩陣
    const matrices = {};
    
    Object.keys(buildingGroups).sort().forEach(building => {
      const buildingSites = buildingGroups[building];
      
      // 找出所有樓層和戶別
      const floors = [...new Set(buildingSites.map(s => s.floor))].sort((a, b) => b - a); // 高樓層在上
      const units = [...new Set(buildingSites.map(s => s.unit))].sort();
      
      // 建立矩陣
      const matrix = {};
      floors.forEach(floor => {
        matrix[floor] = {};
        units.forEach(unit => {
          const site = buildingSites.find(s => s.floor === floor && s.unit === unit);
          matrix[floor][unit] = site || null; // null 表示該位置沒有案場
        });
      });
      
      matrices[building] = {
        floors,
        units,
        matrix
      };
    });

    return matrices;
  }

  /**
   * 更新案場施工狀態
   */
  static updateSiteConstruction(project, engineeringId, siteId, constructionData) {
    const engineering = project.engineerings.find(e => e.id === engineeringId);
    if (!engineering) return null;

    const site = engineering.sites.find(s => s.id === siteId);
    if (!site) return null;

    // 更新施工資料
    site.construction = {
      ...site.construction,
      ...constructionData
    };

    // 如果標記為完成，更新狀態和日期
    if (constructionData.isCompleted) {
      site.status = 'completed';
      site.construction.date = site.construction.date || new Date().toISOString();
    }

    // 重新計算統計
    engineering.statistics = this.calculateStatistics(engineering.sites);
    project.updatedAt = new Date().toISOString();

    return project;
  }

  /**
   * 獲取施工人員縮寫（取名字最後一字）
   */
  static getWorkerAbbreviation(workerName) {
    if (!workerName) return '';
    return workerName.slice(-1);
  }

  /**
   * 格式化日期為 MM/DD
   */
  static formatDateShort(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
}