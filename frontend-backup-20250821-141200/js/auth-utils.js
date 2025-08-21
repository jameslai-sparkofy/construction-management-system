/**
 * 認證工具模組
 * 統一管理 localStorage 的認證相關操作
 */

const AuthUtils = {
    // 統一的 key 名稱
    KEYS: {
        TOKEN: 'token',
        USER: 'user',
        AUTH_TYPE: 'authType',
        // 舊版相容 keys (會自動遷移)
        LEGACY_TOKEN: 'auth_token',
        LEGACY_USER: 'user_info'
    },

    /**
     * 初始化並遷移舊資料
     */
    init() {
        // 遷移舊的 token
        const legacyToken = localStorage.getItem(this.KEYS.LEGACY_TOKEN);
        if (legacyToken && !localStorage.getItem(this.KEYS.TOKEN)) {
            localStorage.setItem(this.KEYS.TOKEN, legacyToken);
            localStorage.removeItem(this.KEYS.LEGACY_TOKEN);
            console.log('Migrated legacy token');
        }

        // 遷移舊的 user info
        const legacyUser = localStorage.getItem(this.KEYS.LEGACY_USER);
        if (legacyUser && !localStorage.getItem(this.KEYS.USER)) {
            localStorage.setItem(this.KEYS.USER, legacyUser);
            localStorage.removeItem(this.KEYS.LEGACY_USER);
            console.log('Migrated legacy user info');
        }
    },

    /**
     * 儲存認證資訊
     */
    saveAuth(token, user, authType = 'simple') {
        localStorage.setItem(this.KEYS.TOKEN, token);
        localStorage.setItem(this.KEYS.USER, JSON.stringify(user));
        localStorage.setItem(this.KEYS.AUTH_TYPE, authType);
        
        // 暫時保留舊版 key 以確保相容性
        localStorage.setItem(this.KEYS.LEGACY_TOKEN, token);
        localStorage.setItem(this.KEYS.LEGACY_USER, JSON.stringify(user));
    },

    /**
     * 取得 token
     */
    getToken() {
        return localStorage.getItem(this.KEYS.TOKEN) || 
               localStorage.getItem(this.KEYS.LEGACY_TOKEN) || 
               null;
    },

    /**
     * 取得使用者資訊
     */
    getUser() {
        const userStr = localStorage.getItem(this.KEYS.USER) || 
                       localStorage.getItem(this.KEYS.LEGACY_USER);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                console.error('Failed to parse user info:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * 取得認證類型
     */
    getAuthType() {
        return localStorage.getItem(this.KEYS.AUTH_TYPE) || 'simple';
    },

    /**
     * 檢查是否已登入
     */
    isAuthenticated() {
        const token = this.getToken();
        return !!token;
    },

    /**
     * 登出並清除所有認證資訊
     */
    logout() {
        // 清除所有相關 keys
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    /**
     * 取得認證 header
     */
    getAuthHeader() {
        const token = this.getToken();
        return token ? `Bearer ${token}` : null;
    },

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
    },

    /**
     * 檢查並重導向未登入使用者
     */
    requireAuth(redirectUrl = '/login.html') {
        if (!this.isAuthenticated()) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    },

    /**
     * 檢查 token 是否為開發模式 (已移除 demo-token 支援)
     */
    isDemoMode() {
        // Demo mode has been removed for security reasons
        return false;
    }
};

// 自動初始化
if (typeof window !== 'undefined') {
    AuthUtils.init();
}