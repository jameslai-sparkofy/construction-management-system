/**
 * 統一權限查詢系統
 * 整合 Supabase 認證和 D1 權限資料
 */

class UnifiedPermissions {
    constructor() {
        this.supabase = window.supabase || null;
        this.workerApiUrl = window.CONFIG?.API?.WORKER_API_URL || 'https://construction-management-api.lai-jameslai.workers.dev';
        this.currentUser = null;
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
     * 獲取用戶在專案中的權限
     */
    async getProjectPermissions(projectId) {
        // 檢查快取
        const cacheKey = `${projectId}_${this.currentUser?.id}`;
        if (this.userPermissions.has(cacheKey)) {
            return this.userPermissions.get(cacheKey);
        }
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(
                `${this.workerApiUrl}/api/v1/projects/${projectId}/permissions`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                const permissions = await response.json();
                
                // 查找當前用戶的權限
                const userId = this.currentUser?.d1_user_id || this.currentUser?.id;
                const userPermission = permissions.find(p => 
                    p.user_id === userId || 
                    p.phone === this.currentUser?.phone
                );
                
                if (userPermission) {
                    // 快取權限
                    this.userPermissions.set(cacheKey, userPermission);
                    return userPermission;
                }
            }
        } catch (error) {
            console.error('獲取專案權限失敗:', error);
        }
        
        return null;
    }

    /**
     * 檢查用戶是否為管理員
     */
    async isAdmin() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.workerApiUrl}/api/v1/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                return userData.role === 'admin';
            }
        } catch (error) {
            console.error('檢查 admin 權限失敗:', error);
        }
        
        return false;
    }

    /**
     * 檢查特定權限
     */
    async hasPermission(projectId, permission) {
        // 管理員擁有所有權限
        if (await this.isAdmin()) {
            return true;
        }
        
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
     * 獲取用戶角色
     */
    async getUserRole(projectId) {
        const permissions = await this.getProjectPermissions(projectId);
        return permissions?.role || 'guest';
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