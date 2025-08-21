// 權限管理模組
class PermissionManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.currentUser = null;
        this.userRole = null;
        this.projectPermissions = new Map();
    }
    
    // 初始化：取得當前用戶資訊
    async init() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            throw new Error('用戶未登入');
        }
        
        this.currentUser = user;
        
        // 取得全域角色
        const { data: userRoles } = await this.supabase
            .from('user_roles')
            .select('roles(name)')
            .eq('user_id', user.id)
            .single();
        
        if (userRoles?.roles) {
            this.userRole = userRoles.roles.name;
        }
        
        return this.currentUser;
    }
    
    // 檢查是否為管理員
    isAdmin() {
        return this.userRole === 'admin';
    }
    
    // 取得用戶在專案中的權限
    async getProjectPermissions(projectId) {
        // 檢查快取
        if (this.projectPermissions.has(projectId)) {
            return this.projectPermissions.get(projectId);
        }
        
        // 管理員擁有所有權限
        if (this.isAdmin()) {
            const adminPerms = {
                role: 'admin',
                can_view: true,
                can_edit: true,
                can_delete: true,
                can_manage_members: true,
                can_view_other_teams: true
            };
            this.projectPermissions.set(projectId, adminPerms);
            return adminPerms;
        }
        
        // 查詢專案權限
        const { data, error } = await this.supabase
            .from('project_permissions')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', this.currentUser.id)
            .single();
        
        if (error || !data) {
            return null;
        }
        
        this.projectPermissions.set(projectId, data);
        return data;
    }
    
    // 檢查特定權限
    async hasPermission(projectId, permission) {
        const perms = await this.getProjectPermissions(projectId);
        if (!perms) return false;
        
        switch (permission) {
            case 'view':
                return perms.can_view === true;
            case 'edit':
                return perms.can_edit === true;
            case 'delete':
                return perms.can_delete === true;
            case 'manage_members':
                return perms.can_manage_members === true;
            case 'view_other_teams':
                return perms.can_view_other_teams === true;
            default:
                return false;
        }
    }
    
    // 取得用戶可存取的專案列表
    async getUserProjects() {
        if (this.isAdmin()) {
            // 管理員取得所有專案
            const { data, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });
            
            return data || [];
        }
        
        // 一般用戶取得有權限的專案
        const { data, error } = await this.supabase
            .from('project_permissions')
            .select(`
                project_id,
                role,
                can_edit,
                can_manage_members,
                projects (*)
            `)
            .eq('user_id', this.currentUser.id);
        
        if (error || !data) {
            return [];
        }
        
        // 整理資料格式
        return data.map(item => ({
            ...item.projects,
            user_role: item.role,
            can_edit: item.can_edit,
            can_manage_members: item.can_manage_members
        }));
    }
    
    // 授予權限
    async grantPermission(projectId, userId, permissions) {
        // 檢查是否有權限管理權限
        const hasManagePermission = await this.hasPermission(projectId, 'manage_members');
        if (!hasManagePermission && !this.isAdmin()) {
            throw new Error('沒有權限執行此操作');
        }
        
        const { data, error } = await this.supabase
            .from('project_permissions')
            .upsert({
                project_id: projectId,
                user_id: userId,
                ...permissions,
                granted_by: this.currentUser.id,
                granted_at: new Date().toISOString()
            });
        
        if (error) {
            throw error;
        }
        
        // 記錄權限變更
        await this.logPermissionChange('grant', userId, projectId, permissions);
        
        return data;
    }
    
    // 撤銷權限
    async revokePermission(projectId, userId) {
        // 檢查是否有權限管理權限
        const hasManagePermission = await this.hasPermission(projectId, 'manage_members');
        if (!hasManagePermission && !this.isAdmin()) {
            throw new Error('沒有權限執行此操作');
        }
        
        const { error } = await this.supabase
            .from('project_permissions')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);
        
        if (error) {
            throw error;
        }
        
        // 記錄權限變更
        await this.logPermissionChange('revoke', userId, projectId, null);
    }
    
    // 記錄權限變更
    async logPermissionChange(action, targetUserId, projectId, permissions) {
        await this.supabase
            .from('permission_logs')
            .insert({
                action,
                target_user_id: targetUserId,
                project_id: projectId,
                permissions,
                performed_by: this.currentUser.id,
                performed_at: new Date().toISOString()
            });
    }
    
    // UI 權限控制輔助函數
    showElement(element, permission, projectId) {
        this.hasPermission(projectId, permission).then(hasPermission => {
            if (hasPermission) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });
    }
    
    // 禁用元素
    disableElement(element, permission, projectId) {
        this.hasPermission(projectId, permission).then(hasPermission => {
            element.disabled = !hasPermission;
            if (!hasPermission) {
                element.title = '您沒有權限執行此操作';
            }
        });
    }
}

// 使用範例
async function initializePermissions() {
    // 假設 supabase 已經初始化
    const permManager = new PermissionManager(window.supabase);
    
    try {
        await permManager.init();
        console.log('權限系統初始化成功');
        
        // 取得用戶專案
        const projects = await permManager.getUserProjects();
        console.log('用戶專案:', projects);
        
        // 檢查權限
        if (projects.length > 0) {
            const projectId = projects[0].id;
            const canEdit = await permManager.hasPermission(projectId, 'edit');
            console.log('編輯權限:', canEdit);
        }
        
        return permManager;
    } catch (error) {
        console.error('權限初始化失敗:', error);
        throw error;
    }
}

// 匯出供其他頁面使用
if (typeof window !== 'undefined') {
    window.PermissionManager = PermissionManager;
    window.initializePermissions = initializePermissions;
}