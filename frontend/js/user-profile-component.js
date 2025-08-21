/**
 * 統一用戶資料組件
 * 提供右上角個人設定連結和角色顯示功能
 */

class UserProfileComponent {
    constructor(options = {}) {
        this.showRole = options.showRole || false;
        this.showProfile = options.showProfile !== false; // 預設顯示，除非明確設為 false
        this.projectId = options.projectId || null;
        this.container = options.container || null; // 指定容器
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
        profileContainer.className = 'user-profile-container';
        profileContainer.style.display = 'flex';
        profileContainer.style.alignItems = 'center';
        profileContainer.style.gap = '0.75rem';
        
        profileContainer.innerHTML = `
            <!-- 個人設定下拉選單 - 按鈕樣式 -->
            <div class="relative">
                <button id="profile-menu-button" class="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 shadow-lg transition-all duration-200 hover:shadow-xl flex items-center gap-2">
                    <span class="text-lg">👤</span>
                    <span class="text-sm font-medium text-gray-700" id="profile-button-name">載入中...</span>
                </button>
                
                <!-- 下拉選單 -->
                <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <p class="text-sm font-medium text-gray-900" id="user-name">載入中...</p>
                        <p class="text-xs text-blue-600 mt-1" id="user-role-detail">載入中...</p>
                        <p class="text-sm text-gray-500" id="user-phone">載入中...</p>
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
        
        // 插入到指定容器或 body
        if (this.container) {
            this.container.appendChild(profileContainer);
        } else {
            document.body.appendChild(profileContainer);
        }
        
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
            
            // 總是載入角色資料（用於下拉選單顯示）
            await this.loadUserRole();
            
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
                this.isAdmin = authUser.role === 'admin' || authUser.user_type === 'admin' || 
                              authUser.role === 'super_admin' || authUser.user_type === 'super_admin' ||
                              authUser.global_role === 'admin' || authUser.global_role === 'super_admin';
                return;
            }
        }
        
        try {
            // 嘗試從 API 載入
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            const response = await fetch(`${window.CONFIG?.API?.WORKER_API_URL}/api/v1/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const responseData = await response.json();
                
                // 處理API響應格式，支援直接用戶對象或包裝在user屬性中
                this.currentUser = responseData.user || responseData;
                
                this.isAdmin = this.currentUser.role === 'admin' || this.currentUser.user_type === 'admin' || 
                              this.currentUser.role === 'super_admin' || this.currentUser.user_type === 'super_admin' ||
                              this.currentUser.global_role === 'admin' || this.currentUser.global_role === 'super_admin';
                
                // 確保包含 source_id 用於用戶匹配
                if (this.currentUser.source_id) {
                    this.currentUser.source_id = this.currentUser.source_id;
                }
                
                console.log('用戶資料載入成功:', this.currentUser);
                return;
            }
        } catch (error) {
            console.log('API 載入用戶失敗，嘗試從 localStorage');
        }
        
        // 備用：從 localStorage 載入
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.id) {
            this.currentUser = userData;
            this.isAdmin = userData.role === 'admin' || userData.user_type === 'admin' || 
                          userData.role === 'super_admin' || userData.user_type === 'super_admin' ||
                          userData.global_role === 'admin' || userData.global_role === 'super_admin';
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
            
            // 如果是 super_admin，直接顯示超級管理員角色，不需要查詢專案資料
            if (this.currentUser.global_role === 'super_admin' || 
                this.currentUser.role === 'super_admin' || 
                this.currentUser.user_type === 'super_admin' ||
                (this.currentUser.id && this.currentUser.id.includes('super_admin'))) {
                this.currentUserRole = this.getRoleDisplayName('super_admin');
                console.log('檢測到Super Admin，直接設定角色:', this.currentUserRole);
                return;
            }
            
            // 獲取用戶在專案中的詳細資訊
            const userInfo = await this.getUserProjectInfo();
            if (userInfo) {
                // 顯示角色和工班資訊，優先使用具體的 role
                const roleText = this.getRoleDisplayName(userInfo.role || userInfo.user_type);
                if (userInfo.team_name) {
                    this.currentUserRole = `${roleText} - ${userInfo.team_name}`;
                    this.currentUserTeam = userInfo.team_name;
                } else {
                    this.currentUserRole = roleText;
                }
            } else {
                // 備用邏輯：如果是管理員，直接顯示管理員角色
                if (this.isAdmin) {
                    this.currentUserRole = this.getRoleDisplayName(this.currentUser.global_role || this.currentUser.role || this.currentUser.user_type || 'admin');
                } else {
                    // 使用統一權限系統
                    if (window.permissions) {
                        const displayRole = await window.permissions.getUserDisplayRole(this.projectId);
                        this.currentUserRole = this.getRoleDisplayName(displayRole);
                    } else {
                        this.currentUserRole = this.getRoleDisplayName(this.currentUser.global_role || this.currentUser.role || this.currentUser.user_type);
                    }
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
                `${window.CONFIG?.API?.WORKER_API_URL}/api/v1/projects/${this.projectId}/users`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                const responseData = await response.json();
                
                // 處理API響應格式，支援直接數組或包裝在data屬性中
                const users = Array.isArray(responseData) ? responseData : (responseData.data || []);
                
                // 確保users是數組
                if (!Array.isArray(users)) {
                    console.warn('API返回的users不是數組:', users);
                    return null;
                }
                
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
            'super_admin': '超級管理員',
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
        const profileButtonNameEl = document.getElementById('profile-button-name');
        
        if (this.currentUser) {
            // 確保姓名顯示正確，優先使用 currentUser 的資料
            const displayName = this.currentUser.name || this.currentUser.username || '未設定姓名';
            if (userNameEl) userNameEl.textContent = displayName;
            if (profileButtonNameEl) profileButtonNameEl.textContent = displayName;
            
            const displayPhone = this.currentUser.phone || this.currentUser.mobile || '未設定電話';
            if (userPhoneEl) userPhoneEl.textContent = displayPhone;
            
            if (userRoleDetailEl) {
                // 總是在下拉選單中顯示角色資訊
                userRoleDetailEl.textContent = this.currentUserRole || '載入中...';
            }
        } else {
            // 如果 currentUser 不存在，顯示載入中
            if (userNameEl) userNameEl.textContent = '載入中...';
            if (userPhoneEl) userPhoneEl.textContent = '載入中...';
            if (profileButtonNameEl) profileButtonNameEl.textContent = '載入中...';
            if (userRoleDetailEl) {
                userRoleDetailEl.textContent = '載入中...';
            }
        }
        
        // 統一圖標顯示 - 不顯示額外的角色標籤
        // 角色資訊只在下拉選單中顯示，保持頂部圖標簡潔
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