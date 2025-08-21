/**
 * 統一權限管理系統
 * 處理真實用戶權限和 Admin 視角切換
 * 多重角色自動合併為最高權限
 */

class UnifiedPermissions {
    constructor() {
        this.supabase = window.supabase || null;
        this.workerApiUrl = window.CONFIG?.API?.WORKER_API_URL || 'ERROR_NO_CONFIG';
        this.currentUser = null;
        this.simulatedUser = null; // Admin 模擬的用戶
        this.userPermissions = new Map(); // 快取權限資料
    }

    /**
     * 初始化並獲取當前用戶
     */
    async init() {
        try {
            // 1. 嘗試從 Supabase 獲取用戶
            if (this.supabase) {
                const { data: { user } } = await this.supabase.auth.getUser();
                if (user) {
                    this.currentUser = {
                        id: user.id,
                        email: user.email,
                        phone: user.user_metadata?.phone,
                        source: 'supabase'
                    };
                    
                    // 獲取 D1 映射
                    await this.fetchD1Mapping(user.id);
                    return this.currentUser;
                }
            }
            
            // 2. 如果沒有 Supabase，使用本地 session
            const localUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (localUser.id) {
                this.currentUser = {
                    ...localUser,
                    source: 'd1'
                };
                return this.currentUser;
            }
            
            return null;
        } catch (error) {
            console.error('初始化權限系統失敗:', error);
            return null;
        }
    }

    /**
     * 獲取 D1 用戶映射
     */
    async fetchD1Mapping(supabaseUserId) {
        try {
            // 從 Supabase 獲取映射
            if (this.supabase) {
                const { data } = await this.supabase
                    .from('auth_mapping')
                    .select('d1_user_id, d1_user_phone')
                    .eq('auth_user_id', supabaseUserId)
                    .single();
                
                if (data) {
                    this.currentUser.d1_user_id = data.d1_user_id;
                    this.currentUser.d1_user_phone = data.d1_user_phone;
                }
            }
        } catch (error) {
            console.log('無法獲取 D1 映射:', error);
        }
    }

    /**
     * 獲取當前 context 的用戶（可能是真實或模擬）
     */
    getCurrentContextUser() {
        // 如果 Admin 正在模擬其他用戶，返回模擬用戶
        if (this.simulatedUser) {
            return this.simulatedUser;
        }
        // 否則返回真實登入用戶
        return this.currentUser;
    }

    /**
     * 獲取用戶在專案中的權限
     * 統一處理真實和模擬用戶
     */
    async getProjectPermissions(projectId) {
        const contextUser = this.getCurrentContextUser();
        if (!contextUser) return null;
        
        // 檢查快取
        const cacheKey = `${projectId}_${contextUser.id}`;
        if (this.userPermissions.has(cacheKey)) {
            return this.userPermissions.get(cacheKey);
        }
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(
                `${this.workerApiUrl}/api/v1/projects/${projectId}/users`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                const responseData = await response.json();
                const users = responseData.data?.all || responseData; // 支援新舊API格式
                
                if (Array.isArray(users)) {
                    // 查找 context 用戶的權限
                    const userPermission = users.find(u => 
                    u.user_id === contextUser.id || 
                    u.phone === contextUser.phone ||
                    u.user_id === contextUser.source_id ||
                    (contextUser.d1_user_id && u.user_id === contextUser.d1_user_id)
                );
                
                    if (userPermission) {
                        // 快取權限
                        this.userPermissions.set(cacheKey, userPermission);
                        return userPermission;
                    }
                } else {
                    console.log('API回應格式不正確，users不是陣列:', typeof users);
                }
            }
        } catch (error) {
            console.error('獲取專案權限失敗:', error);
        }
        
        return null;
    }

    /**
     * 獲取用戶在特定案場的權限（基於工班上下文）
     */
    async getSitePermissions(siteId, teamId) {
        const contextUser = this.getCurrentContextUser();
        if (!contextUser) return null;
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(
                `${this.workerApiUrl}/api/v1/sites/${siteId}/permissions`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                const permissions = await response.json();
                return permissions;
            }
        } catch (error) {
            console.error('獲取案場權限失敗:', error);
        }
        
        // 預設權限邏輯
        if (contextUser.user_type === 'admin' || contextUser.user_type === 'super_admin') {
            return { can_view: true, can_edit: true, can_manage_members: true, can_view_other_teams: true };
        }
        if (contextUser.user_type === 'owner') {
            return { can_view: true, can_edit: false, can_manage_members: false, can_view_other_teams: true };
        }
        
        // 工人權限取決於在該工班的角色
        const projectPerms = await this.getProjectPermissions();
        if (projectPerms && projectPerms.team_contexts) {
            const teamContext = projectPerms.team_contexts.find(tc => tc.team_id === teamId);
            if (teamContext) {
                return {
                    can_view: true,
                    can_edit: true,
                    can_manage_members: teamContext.role === 'leader',
                    can_view_other_teams: false
                };
            }
        }
        
        return { can_view: false, can_edit: false, can_manage_members: false, can_view_other_teams: false };
    }

    /**
     * 檢查當前真實用戶是否為管理員（不受模擬影響）
     */
    async isAdmin() {
        // 注意：這裡故意使用 currentUser 而非 getCurrentContextUser()
        // 因為只有真實的 admin 才能進行視角切換
        if (!this.currentUser) return false;
        
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.workerApiUrl}/api/v1/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                console.log('isAdmin API response:', userData);
                
                // Check if response has nested user object
                const user = userData.user || userData;
                return user.role === 'admin' || user.user_type === 'admin' || user.role === 'super_admin' || user.user_type === 'super_admin' || user.global_role === 'super_admin';
            }
        } catch (error) {
            console.error('檢查 admin 權限失敗:', error);
        }
        
        // 本地檢查備用 - 擴展檢查更多欄位
        const user = this.currentUser;
        if (user.role === 'super_admin' || 
            user.global_role === 'super_admin' || 
            user.user_type === 'super_admin' ||
            user.role === 'admin' || 
            user.global_role === 'admin' || 
            user.user_type === 'admin' ||
            (user.d1_user_id && user.d1_user_id.includes('super_admin'))) {
            console.log('本地檢查確認為管理員:', user);
            return true;
        }
        
        console.log('權限檢查失敗，用戶數據:', user);
        return false;
    }

    /**
     * 檢查是否正在模擬
     */
    isSimulating() {
        return this.simulatedUser !== null;
    }

    /**
     * 檢查特定權限
     * 使用 context user（可能是模擬的）
     */
    async hasPermission(projectId, permission) {
        const contextUser = this.getCurrentContextUser();
        if (!contextUser) return false;
        
        // 如果 context user 是 admin（不是正在模擬），擁有所有權限
        if (!this.isSimulating() && (contextUser.user_type === 'admin' || contextUser.user_type === 'super_admin')) {
            return true;
        }
        
        // 否則檢查實際權限
        const projectPerms = await this.getProjectPermissions(projectId);
        if (!projectPerms) return false;
        
        switch (permission) {
            case 'view':
                return projectPerms.can_view === true || projectPerms.can_view === 1;
            case 'edit':
                return projectPerms.can_edit === true || projectPerms.can_edit === 1;
            case 'manage_members':
                return projectPerms.can_manage_members === true || projectPerms.can_manage_members === 1;
            case 'view_other_teams':
                return projectPerms.can_view_other_teams === true || projectPerms.can_view_other_teams === 1;
            default:
                return false;
        }
    }

    /**
     * 獲取用戶在特定工班的角色
     */
    async getUserRoleInTeam(projectId, teamId) {
        const permissions = await this.getProjectPermissions(projectId);
        
        // Admin 和 Owner 不屬於工班
        if (permissions?.user_type === 'admin' || permissions?.user_type === 'super_admin') return 'admin';
        if (permissions?.user_type === 'owner') return 'owner';
        
        // 工人在不同工班有不同角色
        if (permissions?.team_contexts && Array.isArray(permissions.team_contexts)) {
            const teamContext = permissions.team_contexts.find(tc => tc.team_id === teamId);
            if (teamContext) {
                return teamContext.role === 'leader' ? 'foreman' : 'worker';
            }
        }
        
        return 'guest';
    }
    
    /**
     * 獲取用戶的主要角色（用於顯示）
     */
    async getUserDisplayRole(projectId) {
        const permissions = await this.getProjectPermissions(projectId);
        
        if (permissions?.user_type === 'admin' || permissions?.user_type === 'super_admin') return 'admin';
        if (permissions?.user_type === 'owner') return 'owner';
        
        // 如果在任何工班是工班長，顯示為工班長
        if (permissions?.team_contexts && Array.isArray(permissions.team_contexts)) {
            const hasLeaderRole = permissions.team_contexts.some(tc => tc.role === 'leader');
            if (hasLeaderRole) return 'foreman';
        }
        
        return 'worker';
    }

    /**
     * Admin 切換視角（模擬其他用戶）
     */
    async switchPerspective(targetUserId, projectId) {
        // 只有真實 admin 才能切換視角
        if (!await this.isAdmin()) {
            console.error('只有管理員可以切換視角');
            return false;
        }
        
        if (targetUserId === null) {
            // 返回真實視角
            this.simulatedUser = null;
            this.clearCache();
            return true;
        }
        
        try {
            // 獲取目標用戶資料
            const token = localStorage.getItem('auth_token');
            const response = await fetch(
                `${this.workerApiUrl}/api/v1/projects/${projectId}/users`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                const responseData = await response.json();
                const users = responseData.data?.all || responseData; // 支援新舊API格式
                
                if (Array.isArray(users)) {
                    const targetUser = users.find(u => u.user_id === targetUserId);
                
                if (targetUser) {
                    // 設定模擬用戶
                    this.simulatedUser = {
                        id: targetUser.user_id,
                        name: targetUser.name,
                        phone: targetUser.phone,
                        user_type: targetUser.user_type,
                        roles: targetUser.roles,
                        teams: targetUser.teams
                    };
                    
                    // 清除權限快取以強制重新載入
                    this.clearCache();
                    return true;
                }
                } else {
                    console.log('switchPerspective: API回應格式不正確');
                }
            }
        } catch (error) {
            console.error('切換視角失敗:', error);
        }
        
        return false;
    }

    /**
     * 創建認證帳號並同步到 D1
     */
    async createAuthAccount(userData) {
        const { phone, name, role, projectId } = userData;
        const password = phone.slice(-3); // 密碼為電話末3碼
        
        try {
            // 1. 如果有 Supabase，建立認證帳號
            if (this.supabase) {
                const { data, error } = await this.supabase.auth.signUp({
                    email: userData.email || `${phone}@construction.local`,
                    password: password,
                    options: {
                        data: {
                            phone: phone,
                            full_name: name,
                            role: role
                        }
                    }
                });
                
                if (error && !error.message.includes('already registered')) {
                    throw error;
                }
                
                // 建立映射
                if (data?.user) {
                    await this.createAuthMapping(data.user.id, userData.d1_user_id || phone, phone);
                }
            }
            
            // 2. 在 D1 建立或更新用戶和權限
            const token = localStorage.getItem('auth_token');
            const response = await fetch(
                `${this.workerApiUrl}/api/v1/projects/${projectId}/permissions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        user_id: userData.d1_user_id || phone,
                        name: name,
                        phone: phone,
                        email: userData.email,
                        role: role,
                        ...this.getDefaultPermissions(role)
                    })
                }
            );
            
            if (!response.ok) {
                throw new Error('D1 權限設定失敗');
            }
            
            return true;
        } catch (error) {
            console.error('建立認證帳號失敗:', error);
            throw error;
        }
    }

    /**
     * 建立認證映射
     */
    async createAuthMapping(authUserId, d1UserId, phone) {
        if (!this.supabase) return;
        
        try {
            const { error } = await this.supabase
                .from('auth_mapping')
                .upsert({
                    auth_user_id: authUserId,
                    d1_user_id: d1UserId,
                    d1_user_phone: phone,
                    last_synced_at: new Date().toISOString()
                });
            
            if (error) {
                console.error('建立認證映射失敗:', error);
            }
        } catch (error) {
            console.error('映射錯誤:', error);
        }
    }

    /**
     * 獲取角色的預設權限
     */
    getDefaultPermissions(role) {
        switch (role) {
            case 'admin':
                return {
                    can_view: true,
                    can_edit: true,
                    can_manage_members: true,
                    can_view_other_teams: true
                };
            case 'owner':
                return {
                    can_view: true,
                    can_edit: false,
                    can_manage_members: false,
                    can_view_other_teams: true
                };
            case 'foreman':
                return {
                    can_view: true,
                    can_edit: true,
                    can_manage_members: true,
                    can_view_other_teams: false
                };
            case 'worker':
                return {
                    can_view: true,
                    can_edit: true,
                    can_manage_members: false,
                    can_view_other_teams: false
                };
            default:
                return {
                    can_view: false,
                    can_edit: false,
                    can_manage_members: false,
                    can_view_other_teams: false
                };
        }
    }

    /**
     * 清除權限快取
     */
    clearCache() {
        this.userPermissions.clear();
    }

    /**
     * 登出
     */
    async logout() {
        this.clearCache();
        this.currentUser = null;
        
        if (this.supabase) {
            await this.supabase.auth.signOut();
        }
        
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
    }
}

// 建立全域實例
if (typeof window !== 'undefined') {
    window.UnifiedPermissions = UnifiedPermissions;
    window.permissions = new UnifiedPermissions();
}