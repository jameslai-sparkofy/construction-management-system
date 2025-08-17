/**
 * 統一認證系統
 * 整合所有認證相關功能，支援多種認證方式
 */

class UnifiedAuth {
    constructor() {
        this.STORAGE_KEYS = {
            // 統一使用簡單的 key 名稱，與其他頁面一致
            TOKEN: 'token',
            USER: 'user',
            AUTH_TYPE: 'auth_type',
            // Legacy keys (will be migrated)
            LEGACY_TOKEN: 'auth_token',  // 舊的 key 名稱
            LEGACY_USER: 'user_info'      // 舊的 key 名稱
        };
        
        this.AUTH_TYPES = {
            SIMPLE: 'simple',
            EMERGENCY: 'emergency'
        };
        
        this.init();
    }
    
    /**
     * 初始化並遷移舊資料
     */
    init() {
        this.migrateLegacyData();
        // 暫時停用自動 token 驗證，因為會造成問題
        // TODO: 實現更好的 token 驗證機制
        // if (!this.isLoginPage()) {
        //     this.checkTokenValidity();
        // }
    }
    
    /**
     * 檢查是否為登入頁面
     */
    isLoginPage() {
        const currentPage = window.location.pathname;
        return currentPage.includes('login') || currentPage.includes('index.html') || currentPage === '/';
    }
    
    /**
     * 遷移舊格式的認證資料
     */
    migrateLegacyData() {
        // 遷移 token
        const legacyToken = localStorage.getItem(this.STORAGE_KEYS.LEGACY_TOKEN);
        if (legacyToken && !this.getToken()) {
            localStorage.setItem(this.STORAGE_KEYS.TOKEN, legacyToken);
            localStorage.removeItem(this.STORAGE_KEYS.LEGACY_TOKEN);
            console.log('Migrated legacy token');
        }
        
        // 遷移 user
        const legacyUser = localStorage.getItem(this.STORAGE_KEYS.LEGACY_USER);
        if (legacyUser && !this.getUser()) {
            localStorage.setItem(this.STORAGE_KEYS.USER, legacyUser);
            localStorage.removeItem(this.STORAGE_KEYS.LEGACY_USER);
            console.log('Migrated legacy user');
        }
    }
    
    /**
     * 檢查 token 有效性
     */
    async checkTokenValidity() {
        const token = this.getToken();
        if (!token) return false;
        
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.status === 401) {
                // 只清除 token，不要立即跳轉
                this.clearAuth();
                return false;
            }
            
            return response.ok;
        } catch (error) {
            console.warn('Token validation failed:', error);
            // 網路錯誤時不清除 token，可能只是暫時的連線問題
            return false;
        }
    }
    
    /**
     * 清除認證資料（不跳轉）
     */
    clearAuth() {
        // 清除所有認證相關資料
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // 清除可能存在的舊 Clerk token
        localStorage.removeItem('clerk-db-jwt');
        localStorage.removeItem('clerk_token');
        localStorage.removeItem('clerk_user');
    }
    
    /**
     * 簡單認證登入
     */
    async loginSimple(phone, password) {
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone, password })
            });
            
            const data = await response.json();
            
            if (data.success && data.data) {
                this.saveAuth(
                    data.data.token,
                    data.data.user,
                    this.AUTH_TYPES.SIMPLE
                );
                return { success: true, user: data.data.user };
            } else {
                return { success: false, error: data.message || '登入失敗' };
            }
        } catch (error) {
            console.error('Simple login error:', error);
            return { success: false, error: '系統錯誤，請稍後再試' };
        }
    }
    
    
    /**
     * 緊急登入（如果啟用）
     */
    async loginEmergency(phone, code) {
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/auth/emergency`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone, code })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.saveAuth(
                    data.token,
                    data.user,
                    this.AUTH_TYPES.EMERGENCY
                );
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error || '緊急登入失敗' };
            }
        } catch (error) {
            console.error('Emergency login error:', error);
            return { success: false, error: '緊急登入系統錯誤' };
        }
    }
    
    /**
     * 儲存認證資訊
     */
    saveAuth(token, user, authType = this.AUTH_TYPES.SIMPLE) {
        // 統一使用 localStorage 儲存
        localStorage.setItem(this.STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(this.STORAGE_KEYS.AUTH_TYPE, authType);
        
        // 觸發認證狀態改變事件
        this.dispatchAuthEvent('login', { user, authType });
    }
    
    /**
     * 取得 token
     */
    getToken() {
        return localStorage.getItem(this.STORAGE_KEYS.TOKEN);
    }
    
    /**
     * 取得使用者資訊
     */
    getUser() {
        const userStr = localStorage.getItem(this.STORAGE_KEYS.USER);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                console.error('Failed to parse user info:', e);
                return null;
            }
        }
        return null;
    }
    
    /**
     * 取得認證類型
     */
    getAuthType() {
        return localStorage.getItem(this.STORAGE_KEYS.AUTH_TYPE) || this.AUTH_TYPES.SIMPLE;
    }
    
    /**
     * 檢查是否已登入
     */
    isAuthenticated() {
        return !!this.getToken();
    }
    
    /**
     * 檢查是否為管理員
     */
    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    }
    
    /**
     * 登出
     */
    logout() {
        // 清除所有認證相關資料
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // 清除可能存在的舊 Clerk token
        localStorage.removeItem('clerk-db-jwt');
        localStorage.removeItem('clerk_token');
        localStorage.removeItem('clerk_user');
        
        // 觸發登出事件
        this.dispatchAuthEvent('logout', {});
    }
    
    /**
     * 取得認證 header
     */
    getAuthHeader() {
        const token = this.getToken();
        return token ? `Bearer ${token}` : null;
    }
    
    /**
     * 取得 API 請求的標準 headers
     */
    getRequestHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        const authHeader = this.getAuthHeader();
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        
        return headers;
    }
    
    /**
     * 檢查並重導向未登入使用者
     */
    requireAuth(redirectUrl = 'login-simple.html') {
        if (!this.isAuthenticated()) {
            // 如果沒有 token，直接跳轉到登入頁面
            // 不需要清除，因為本來就沒有
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    }
    
    /**
     * 處理 API 401 錯誤
     */
    handle401() {
        this.clearAuth();
        window.location.href = 'login-simple.html';
    }
    
    /**
     * 發送認證狀態事件
     */
    dispatchAuthEvent(type, data) {
        const event = new CustomEvent(`auth:${type}`, {
            detail: data
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 監聽認證狀態變化
     */
    onAuthChange(callback) {
        window.addEventListener('auth:login', callback);
        window.addEventListener('auth:logout', callback);
    }
    
    /**
     * 取得認證狀態摘要
     */
    getAuthStatus() {
        const user = this.getUser();
        const authType = this.getAuthType();
        
        return {
            isAuthenticated: this.isAuthenticated(),
            user: user,
            authType: authType,
            isAdmin: this.isAdmin(),
            hasValidToken: !!this.getToken()
        };
    }
}

// 建立全域實例
window.UnifiedAuth = new UnifiedAuth();

// 向後相容性 - 保持 AuthUtils 介面
window.AuthUtils = {
    getToken: () => window.UnifiedAuth.getToken(),
    getUser: () => window.UnifiedAuth.getUser(),
    isAuthenticated: () => window.UnifiedAuth.isAuthenticated(),
    logout: () => window.UnifiedAuth.logout(),
    getAuthHeader: () => window.UnifiedAuth.getAuthHeader(),
    getRequestHeaders: () => window.UnifiedAuth.getRequestHeaders(),
    requireAuth: (redirectUrl) => window.UnifiedAuth.requireAuth(redirectUrl),
    saveAuth: (token, user, authType) => window.UnifiedAuth.saveAuth(token, user, authType),
    init: () => window.UnifiedAuth.init(),
    isDemoMode: () => false // Demo mode is disabled
};

console.log('Unified Authentication System initialized');