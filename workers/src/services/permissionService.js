import { ResponseHelper } from '../utils/response.js';

/**
 * 權限服務 - 處理專案權限過濾邏輯
 */
export class PermissionService {
  constructor(env) {
    this.dbEngineering = env.DB_ENGINEERING;
  }

  /**
   * 檢查使用者對專案的存取權限
   */
  async checkProjectAccess(projectId, userId, userRole) {
    try {
      // 管理員可以存取所有專案
      if (userRole === 'admin') {
        return { hasAccess: true, role: 'admin', engineeringTypes: ['ALL'] };
      }

      // 從資料庫查詢使用者在此專案的權限
      const permissions = await this.dbEngineering.prepare(`
        SELECT * FROM project_permissions 
        WHERE project_id = ? AND user_id = ?
      `).bind(projectId, userId).all();

      if (!permissions.results || permissions.results.length === 0) {
        return { hasAccess: false };
      }

      // 整理使用者的權限資料
      const userPermissions = {
        hasAccess: true,
        role: permissions.results[0].role,
        engineeringTypes: [],
        canEdit: false,
        canViewOthers: false
      };

      // 收集所有工程類型權限
      permissions.results.forEach(perm => {
        if (perm.engineering_type === 'ALL' || !userPermissions.engineeringTypes.includes(perm.engineering_type)) {
          userPermissions.engineeringTypes.push(perm.engineering_type);
        }
        if (perm.can_edit) userPermissions.canEdit = true;
        if (perm.can_view_others) userPermissions.canViewOthers = true;
      });

      return userPermissions;
    } catch (error) {
      console.error('Check project access error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * 過濾使用者可見的工程類型
   */
  filterVisibleEngineering(project, userPermissions) {
    // 管理員或業主可以看到所有工程
    if (userPermissions.role === 'admin' || userPermissions.role === 'owner') {
      return {
        spc: project.spc_engineering,
        cabinet: project.cabinet_engineering
      };
    }

    // 工班成員只能看到自己負責的工程類型
    const filtered = {
      spc: null,
      cabinet: null
    };

    if (userPermissions.engineeringTypes.includes('ALL')) {
      // 有 ALL 權限，可以看到所有工程
      filtered.spc = project.spc_engineering;
      filtered.cabinet = project.cabinet_engineering;
    } else {
      // 只能看到特定工程類型
      if (userPermissions.engineeringTypes.includes('SPC')) {
        filtered.spc = project.spc_engineering;
      }
      if (userPermissions.engineeringTypes.includes('CABINET')) {
        filtered.cabinet = project.cabinet_engineering;
      }
    }

    return filtered;
  }

  /**
   * 過濾案場列表（根據權限）
   */
  filterSitesByPermission(sites, userPermissions, engineeringType) {
    // 管理員和業主可以看到所有案場
    if (userPermissions.role === 'admin' || userPermissions.role === 'owner') {
      return sites;
    }

    // 檢查是否有該工程類型的權限
    if (!userPermissions.engineeringTypes.includes('ALL') && 
        !userPermissions.engineeringTypes.includes(engineeringType)) {
      return [];
    }

    // 如果不能查看其他工班的進度，需要進一步過濾
    if (!userPermissions.canViewOthers) {
      // TODO: 根據案場的工班欄位過濾
      // 目前先返回所有案場，實際應該過濾 field_u1wpv__c (工班師父)
      return sites;
    }

    return sites;
  }

  /**
   * 檢查使用者是否可以編輯案場
   */
  canEditSite(userPermissions, engineeringType) {
    // 管理員和工班負責人可以編輯
    if (userPermissions.role === 'admin' || userPermissions.role === 'leader') {
      return true;
    }

    // 工班成員需要有編輯權限
    if (userPermissions.role === 'member' && userPermissions.canEdit) {
      // 檢查是否有該工程類型的權限
      return userPermissions.engineeringTypes.includes('ALL') || 
             userPermissions.engineeringTypes.includes(engineeringType);
    }

    // 業主只能查看，不能編輯
    return false;
  }

  /**
   * 獲取使用者的所有專案列表
   */
  async getUserProjects(userId, userRole) {
    try {
      let projects = [];

      if (userRole === 'admin') {
        // 管理員可以看到所有專案
        const result = await this.dbEngineering.prepare(`
          SELECT * FROM projects WHERE status = 'active'
        `).all();
        projects = result.results || [];
      } else {
        // 其他使用者只能看到有權限的專案
        const result = await this.dbEngineering.prepare(`
          SELECT DISTINCT p.* 
          FROM projects p
          INNER JOIN project_permissions pp ON p.id = pp.project_id
          WHERE pp.user_id = ? AND p.status = 'active'
        `).bind(userId).all();
        projects = result.results || [];
      }

      // 為每個專案加上使用者的權限資訊
      const projectsWithPermissions = await Promise.all(
        projects.map(async (project) => {
          const permissions = await this.checkProjectAccess(project.id, userId, userRole);
          
          // 解析 JSON 欄位
          project.spc_engineering = JSON.parse(project.spc_engineering || '{}');
          project.cabinet_engineering = JSON.parse(project.cabinet_engineering || '{}');
          project.permissions = JSON.parse(project.permissions || '{}');

          // 過濾可見的工程類型
          const visibleEngineering = this.filterVisibleEngineering(project, permissions);
          
          return {
            ...project,
            userPermissions: permissions,
            visibleEngineering
          };
        })
      );

      return ResponseHelper.success({
        projects: projectsWithPermissions,
        total: projectsWithPermissions.length
      });
    } catch (error) {
      console.error('Get user projects error:', error);
      return ResponseHelper.error('獲取專案列表失敗', 500);
    }
  }

  /**
   * 設定專案權限
   */
  async setProjectPermissions(projectId, permissionsData) {
    try {
      // 開始交易
      const statements = [];

      // 清除現有權限
      statements.push(
        this.dbEngineering.prepare(`
          DELETE FROM project_permissions WHERE project_id = ?
        `).bind(projectId)
      );

      // 新增權限
      const { leaders = [], members = [], owners = [], canCrossView = false } = permissionsData;

      // 工班負責人權限
      for (const userId of leaders) {
        statements.push(
          this.dbEngineering.prepare(`
            INSERT INTO project_permissions (
              project_id, user_id, role, engineering_type, can_edit, can_view_others
            ) VALUES (?, ?, 'leader', 'ALL', 1, ?)
          `).bind(projectId, userId, canCrossView ? 1 : 0)
        );
      }

      // 工班成員權限
      for (const userId of members) {
        statements.push(
          this.dbEngineering.prepare(`
            INSERT INTO project_permissions (
              project_id, user_id, role, engineering_type, can_edit, can_view_others
            ) VALUES (?, ?, 'member', 'ALL', 1, ?)
          `).bind(projectId, userId, canCrossView ? 1 : 0)
        );
      }

      // 業主權限（只能查看）
      for (const userId of owners) {
        statements.push(
          this.dbEngineering.prepare(`
            INSERT INTO project_permissions (
              project_id, user_id, role, engineering_type, can_edit, can_view_others
            ) VALUES (?, ?, 'owner', 'ALL', 0, 1)
          `).bind(projectId, userId)
        );
      }

      // 執行所有語句
      await this.dbEngineering.batch(statements);

      return ResponseHelper.success({
        message: '權限設定成功',
        projectId
      });
    } catch (error) {
      console.error('Set project permissions error:', error);
      return ResponseHelper.error('設定權限失敗', 500);
    }
  }

  /**
   * 設定工程類型特定權限
   */
  async setEngineeringPermission(projectId, userId, engineeringType, role, canEdit = false) {
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
        canEdit ? 1 : 0,
        role === 'admin' || role === 'owner' ? 1 : 0
      ).run();

      return ResponseHelper.success({
        message: '工程權限設定成功'
      });
    } catch (error) {
      console.error('Set engineering permission error:', error);
      return ResponseHelper.error('設定工程權限失敗', 500);
    }
  }

  /**
   * 獲取專案的所有權限設定
   */
  async getProjectPermissions(projectId) {
    try {
      const permissions = await this.dbEngineering.prepare(`
        SELECT 
          pp.*,
          u.name as user_name,
          u.phone as user_phone
        FROM project_permissions pp
        LEFT JOIN users u ON pp.user_id = u.id
        WHERE pp.project_id = ?
        ORDER BY pp.role, pp.engineering_type
      `).bind(projectId).all();

      // 整理權限資料
      const organized = {
        leaders: [],
        members: [],
        owners: [],
        canCrossView: false
      };

      (permissions.results || []).forEach(perm => {
        const userInfo = {
          id: perm.user_id,
          name: perm.user_name,
          phone: perm.user_phone,
          engineeringType: perm.engineering_type,
          canEdit: perm.can_edit,
          canViewOthers: perm.can_view_others
        };

        switch (perm.role) {
          case 'leader':
            organized.leaders.push(userInfo);
            break;
          case 'member':
            organized.members.push(userInfo);
            break;
          case 'owner':
            organized.owners.push(userInfo);
            break;
        }

        if (perm.can_view_others) {
          organized.canCrossView = true;
        }
      });

      return ResponseHelper.success(organized);
    } catch (error) {
      console.error('Get project permissions error:', error);
      return ResponseHelper.error('獲取權限設定失敗', 500);
    }
  }
}

export default PermissionService;