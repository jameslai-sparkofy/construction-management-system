/**
 * 統一用戶資料組件
 * 提供右上角個人設定連結和角色顯示功能
 */

class UserProfileComponent {
    constructor(options = {}) {
        this.showRole = options.showRole || false;
        this.showProfile = options.showProfile !== false; // 預設顯示，除非明確設為 false
        this.projectId = options.projectId || null;
        this.currentUser = null;
        this.currentUserRole = null;
        this.isAdmin = false;
        
        this.init();
    }

    async init() {
        // 如果不需要顯示用戶資料組件，直接返回
        if (!this.showProfile) {
            return;
        }
        
        // 創建 HTML 結構
        this.createProfileElement();
        
        // 如果不需要顯示角色，立即隱藏角色顯示元素
        if (!this.showRole) {
            const roleDisplay = document.getElementById('user-role-display');
            if (roleDisplay) {
                roleDisplay.classList.add('hidden');
            }
        }
        
        // 載入用戶資料
        await this.loadUserData();
        
        // 更新顯示
        this.updateDisplay();
    }

    createProfileElement() {
        // 檢查是否已存在
        if (document.getElementById('user-profile-component')) return;
        
        // 創建容器
        const profileContainer = document.createElement('div');
        profileContainer.id = 'user-profile-component';
        profileContainer.className = 'fixed top-4 right-4 z-50 flex items-center gap-3';
        
        profileContainer.innerHTML = `
            <!-- 角色顯示（只在特定頁面顯示） -->
            <div id="user-role-display" class="hidden bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                <span class="mr-1">🏷️</span>
                <span id="user-role-text"></span>
            </div>
            
            <!-- 個人設定下拉選單 -->
            <div class="relative">
                <button id="profile-menu-button" class="bg-white hover:bg-gray-50 border border-gray-300 rounded-full p-2 shadow-sm transition-colors">
                    <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                </button>
                
                <!-- 下拉選單 -->
                <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <p class="text-sm font-medium text-gray-900" id="user-name">載入中...</p>
                        <p class="text-sm text-gray-500" id="user-phone">載入中...</p>
                        ${this.showRole ? '<p class="text-xs text-blue-600 mt-1" id="user-role-detail">載入中...</p>' : ''}
                    </div>
                    <div class="py-1">
                        <a href="#" id="personal-settings-link" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                            <span class="mr-2">⚙️</span>個人設定
                        </a>
                        <a href="#" id="change-password-link" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                            <span class="mr-2">🔐</span>修改密碼
                        </a>
                        <div class="border-t border-gray-200 my-1"></div>
                        <a href="#" id="logout-link" class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                            <span class="mr-2">🚪</span>登出
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // 插入到 body
        document.body.appendChild(profileContainer);
        
        // 綁定事件
        this.bindEvents();
    }

    bindEvents() {
        const menuButton = document.getElementById('profile-menu-button');
        const dropdown = document.getElementById('profile-dropdown');
        const logoutLink = document.getElementById('logout-link');
        
        // 點擊按鈕切換下拉選單
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        
        // 點擊其他地方關閉下拉選單
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });
        
        // 防止下拉選單內點擊時關閉
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // 登出功能
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.logout();
        });
    }

    async loadUserData() {
        try {
            // 檢查是否已登入
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            if (!token) {
                this.redirectToLogin();
                return;
            }
            
            // 載入當前用戶資料
            await this.loadCurrentUser();
            
            // 如果需要顯示角色且有專案ID，載入角色資料
            if (this.showRole && this.projectId) {
                await this.loadUserRole();
            }
            
        } catch (error) {
            console.error('載入用戶資料失敗:', error);
        }
    }

    async loadCurrentUser() {
        // 優先使用 AuthUtils 的資料（如果可用）
        if (typeof window.AuthUtils !== 'undefined') {
            const authUser = window.AuthUtils.getUser();
            if (authUser && authUser.id) {
                this.currentUser = authUser;
                this.isAdmin = authUser.role === 'admin' || authUser.user_type === 'admin';
                return;
            }
        }
        
        try {
            // 嘗試從 API 載入
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL || 'https://construction-management-api.lai-jameslai.workers.dev'}/api/v1/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                this.isAdmin = this.currentUser.role === 'admin' || this.currentUser.user_type === 'admin';
                
                // 確保包含 source_id 用於用戶匹配
                if (this.currentUser.source_id) {
                    this.currentUser.source_id = this.currentUser.source_id;
                }
                return;
            }
        } catch (error) {
            console.log('API 載入用戶失敗，嘗試從 localStorage');
        }
        
        // 備用：從 localStorage 載入
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.id) {
            this.currentUser = userData;
            this.isAdmin = userData.role === 'admin' || userData.user_type === 'admin';
        }
    }

    async loadUserRole() {
        if (!this.currentUser || !this.projectId) return;
        
        try {
            // 如果是管理員，檢查是否在模擬其他用戶
            if (this.isAdmin && window.permissions) {
                const contextUser = window.permissions.getCurrentContextUser();
                if (contextUser && contextUser.id !== this.currentUser.id) {
                    // 正在模擬其他用戶
                    this.currentUserRole = `模擬: ${await window.permissions.getUserDisplayRole(this.projectId)}`;
                    return;
                }
            }
            
            // 獲取用戶在專案中的詳細資訊
            const userInfo = await this.getUserProjectInfo();
            if (userInfo) {
                // 顯示角色和工班資訊
                const roleText = this.getRoleDisplayName(userInfo.role || userInfo.user_type);
                if (userInfo.team_name) {
                    this.currentUserRole = `${roleText} - ${userInfo.team_name}`;
                    this.currentUserTeam = userInfo.team_name;
                } else {
                    this.currentUserRole = roleText;
                }
            } else {
                // 備用邏輯：使用統一權限系統
                if (window.permissions) {
                    const displayRole = await window.permissions.getUserDisplayRole(this.projectId);
                    this.currentUserRole = this.getRoleDisplayName(displayRole);
                } else {
                    this.currentUserRole = this.getRoleDisplayName(this.currentUser.role || this.currentUser.user_type);
                }
            }
            
        } catch (error) {
            console.error('載入用戶角色失敗:', error);
            this.currentUserRole = '未知角色';
        }
    }

    async getUserProjectInfo() {
        if (!this.currentUser || !this.projectId) return null;
        
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            const response = await fetch(
                `${window.CONFIG?.API?.WORKER_API_URL || 'https://construction-management-api.lai-jameslai.workers.dev'}/api/v1/projects/${this.projectId}/users`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                const users = await response.json();
                
                // 查找當前用戶資訊（支援多種匹配方式）
                const userInfo = users.find(user => 
                    user.phone === this.currentUser.phone ||
                    user.user_id === this.currentUser.id ||
                    user.user_id === this.currentUser.source_id ||
                    (this.currentUser.d1_user_id && user.user_id === this.currentUser.d1_user_id)
                );
                
                return userInfo;
            }
        } catch (error) {
            console.error('獲取用戶專案資訊失敗:', error);
        }
        
        return null;
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'admin': '系統管理員',
            'owner': '業主',
            'foreman': '工班長',
            'leader': '工班長',
            'member': '工班成員',
            'worker': '工班成員',
            'guest': '訪客'
        };
        return roleNames[role] || role || '未知角色';
    }

    updateDisplay() {
        // 更新用戶資料顯示
        const userNameEl = document.getElementById('user-name');
        const userPhoneEl = document.getElementById('user-phone');
        const userRoleDetailEl = document.getElementById('user-role-detail');
        
        if (this.currentUser) {
            if (userNameEl) userNameEl.textContent = this.currentUser.name || '未設定姓名';
            if (userPhoneEl) userPhoneEl.textContent = this.currentUser.phone || '未設定電話';
            
            if (userRoleDetailEl && this.showRole) {
                userRoleDetailEl.textContent = `角色: ${this.currentUserRole || '載入中...'}`;
            }
        }
        
        // 顯示或隱藏角色標籤
        const roleDisplay = document.getElementById('user-role-display');
        const roleText = document.getElementById('user-role-text');
        
        if (this.showRole && this.currentUserRole && roleDisplay && roleText) {
            roleText.textContent = this.currentUserRole;
            roleDisplay.classList.remove('hidden');
        } else if (roleDisplay) {
            // 確保當不需要顯示角色時，隱藏角色顯示元素
            roleDisplay.classList.add('hidden');
        }
    }

    async logout() {
        try {
            if (window.permissions && typeof window.permissions.logout === 'function') {
                await window.permissions.logout();
            } else {
                // 手動清除
                localStorage.removeItem('token');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
            }
            
            // 重定向到登入頁面
            this.redirectToLogin();
            
        } catch (error) {
            console.error('登出失敗:', error);
            // 即使失敗也重定向
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        window.location.href = 'login-simple.html';
    }

    // 更新專案ID（用於角色顯示）
    setProjectId(projectId) {
        this.projectId = projectId;
        if (this.showRole) {
            this.loadUserRole().then(() => this.updateDisplay());
        }
    }

    // 手動刷新用戶資料
    async refresh() {
        await this.loadUserData();
        this.updateDisplay();
    }
}

// 全域函數，方便其他頁面使用
window.UserProfileComponent = UserProfileComponent;

// 自動初始化函數
window.initUserProfile = function(options = {}) {
    // 避免重複初始化
    if (window.userProfileInstance) {
        return window.userProfileInstance;
    }
    
    window.userProfileInstance = new UserProfileComponent(options);
    return window.userProfileInstance;
};