/**
 * 優化的專案列表 JavaScript
 * 性能改進版本
 */

class OptimizedProjectList {
    constructor() {
        this.API_BASE_URL = CONFIG?.API?.WORKER_API_URL || 'ERROR_NO_CONFIG';
        this.currentUser = null;
        this.allProjects = [];
        this.filteredProjects = [];
        this.cache = new Map();
        this.isLoading = false;
        
        // DOM elements cache
        this.elements = {};
        this.initElements();
        
        // Performance monitoring
        this.loadStartTime = performance.now();
    }
    
    // 快取 DOM 元素引用
    initElements() {
        const elementIds = [
            'loading', 'projectsContainer', 'emptyState', 'projectsGrid',
            'totalProjects', 'notStartedProjects', 'inProgressProjects', 
            'completedProjects', 'maintenanceProjects', 'searchInput'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    // 初始化
    async init() {
        console.time('ProjectList Init');
        
        // 檢查快取
        const cachedData = this.getCachedData();
        if (cachedData) {
            this.displayCachedData(cachedData);
        }
        
        // 並行載入所有數據
        try {
            await Promise.all([
                this.loadUserInfo(),
                this.loadProjectsOptimized()
            ]);
        } catch (error) {
            console.error('載入失敗:', error);
            this.showError('載入數據失敗，請重新整理頁面');
        } finally {
            console.timeEnd('ProjectList Init');
            this.reportPerformance();
        }
        
        this.setupEventListeners();
        this.filterByStatus('in_progress'); // 預設顯示施工中
    }
    
    // 優化的專案載入
    async loadProjectsOptimized() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            this.showLoading();
            
            // 使用 Promise.allSettled 避免單點失敗
            const [projectsResult, statsResult] = await Promise.allSettled([
                this.fetchProjects(),
                this.fetchProjectStats()
            ]);
            
            // 處理專案數據
            if (projectsResult.status === 'fulfilled') {
                this.allProjects = await this.processProjects(projectsResult.value);
                this.cacheData('projects', this.allProjects);
            } else {
                console.warn('專案載入失敗，使用快取數據');
                this.allProjects = this.getCachedData('projects') || [];
            }
            
            // 處理統計數據
            if (statsResult.status === 'fulfilled') {
                this.updateStats(statsResult.value);
            } else {
                this.updateStatsFromLocal();
            }
            
            this.displayProjects(this.allProjects);
            
        } finally {
            this.hideLoading();
            this.isLoading = false;
        }
    }
    
    // 快取機制
    cacheData(key, data) {
        const cacheEntry = {
            data,
            timestamp: Date.now(),
            ttl: 5 * 60 * 1000 // 5分鐘 TTL
        };
        this.cache.set(key, cacheEntry);
        
        // 也存儲到 localStorage 用於跨頁面快取
        try {
            localStorage.setItem(`projectList_${key}`, JSON.stringify(cacheEntry));
        } catch (e) {
            console.warn('localStorage 快取失敗:', e);
        }
    }
    
    getCachedData(key) {
        // 先檢查記憶體快取
        let cached = this.cache.get(key);
        
        // 如果記憶體沒有，檢查 localStorage
        if (!cached) {
            try {
                const stored = localStorage.getItem(`projectList_${key}`);
                if (stored) {
                    cached = JSON.parse(stored);
                    this.cache.set(key, cached);
                }
            } catch (e) {
                console.warn('localStorage 讀取失敗:', e);
            }
        }
        
        // 檢查 TTL
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
        
        return null;
    }
    
    // 優化的 API 呼叫
    async fetchProjects() {
        const response = await fetch(`${this.API_BASE_URL}/api/v1/projects`, {
            headers: AuthUtils.getRequestHeaders(),
            signal: AbortSignal.timeout(10000) // 10秒超時
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                AuthUtils.logout();
                window.location.href = 'login-simple.html';
                return;
            }
            throw new Error(`API 呼叫失敗: ${response.status}`);
        }
        
        const data = await response.json();
        return data.projects || [];
    }
    
    async fetchProjectStats() {
        try {
            const stats = await Promise.race([
                ProjectStatus.getProjectStats(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('統計載入超時')), 3000)
                )
            ]);
            return stats;
        } catch (error) {
            console.warn('統計載入失敗:', error);
            return null;
        }
    }
    
    // 批量處理專案數據
    async processProjects(rawProjects) {
        if (!rawProjects.length) return [];
        
        console.time('Process Projects');
        
        // 使用 Web Worker 進行 CPU 密集運算（如果支援）
        if (typeof Worker !== 'undefined' && rawProjects.length > 50) {
            try {
                const processed = await this.processProjectsWithWorker(rawProjects);
                console.timeEnd('Process Projects');
                return processed;
            } catch (error) {
                console.warn('Web Worker 處理失敗，使用主執行緒:', error);
            }
        }
        
        // 主執行緒處理（分批處理避免阻塞 UI）
        const processed = await this.processProjectsInChunks(rawProjects);
        console.timeEnd('Process Projects');
        return processed;
    }
    
    // 分批處理專案
    async processProjectsInChunks(projects, chunkSize = 10) {
        const processed = [];
        
        for (let i = 0; i < projects.length; i += chunkSize) {
            const chunk = projects.slice(i, i + chunkSize);
            const chunkProcessed = await Promise.all(
                chunk.map(project => this.processProject(project))
            );
            processed.push(...chunkProcessed);
            
            // 讓出控制權給瀏覽器
            if (i % 30 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return processed;
    }
    
    // 處理單個專案
    async processProject(project) {
        try {
            // 如果有快取的計算結果，直接使用
            const cacheKey = `project_${project.id}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;
            
            // 計算專案狀態和進度
            const processed = await ProjectStatus.calculateProjectStatus(project);
            
            // 快取處理結果
            this.cacheData(cacheKey, processed);
            return processed;
        } catch (error) {
            console.warn(`處理專案 ${project.id} 失敗:`, error);
            return project; // 返回原始數據
        }
    }
    
    // 虛擬滾動 - 對於大量專案的優化
    displayProjects(projects) {
        const grid = this.elements.projectsGrid;
        if (!grid) return;
        
        // 如果專案數量很大，使用虛擬滾動
        if (projects.length > 100) {
            this.setupVirtualScrolling(projects);
            return;
        }
        
        // 使用 DocumentFragment 減少 DOM 操作
        const fragment = document.createDocumentFragment();
        
        projects.forEach(project => {
            const card = this.createProjectCard(project);
            fragment.appendChild(card);
        });
        
        grid.innerHTML = '';
        grid.appendChild(fragment);
        
        this.updateContainerVisibility(projects.length > 0);
    }
    
    // 優化的卡片創建
    createProjectCard(project) {
        const template = this.getCardTemplate();
        const card = template.cloneNode(true);
        
        // 填充數據
        this.populateCard(card, project);
        
        return card;
    }
    
    // 卡片模板快取
    getCardTemplate() {
        if (!this.cardTemplate) {
            this.cardTemplate = this.createCardTemplate();
        }
        return this.cardTemplate;
    }
    
    createCardTemplate() {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="project-card-header">
                <div class="project-card-title">
                    <div class="project-card-name"></div>
                    <div class="project-card-company"></div>
                </div>
                <div class="project-card-status"></div>
            </div>
            <div class="project-card-body">
                <div class="project-card-info">
                    <div class="project-card-label">案場進度</div>
                    <div class="project-card-value"></div>
                </div>
                <div class="project-card-progress-wrapper">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text"></div>
                </div>
            </div>
        `;
        return card;
    }
    
    populateCard(card, project) {
        // 使用 textContent 避免 XSS
        card.querySelector('.project-card-name').textContent = project.name;
        card.querySelector('.project-card-company').textContent = project.company || '';
        
        const progressFill = card.querySelector('.progress-fill');
        const progressText = card.querySelector('.progress-text');
        const progress = project.calculated_progress || 0;
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        
        // 點擊事件
        card.addEventListener('click', () => {
            window.location.href = `project-detail.html?id=${project.id}`;
        });
    }
    
    // 事件監聽器優化
    setupEventListeners() {
        // 使用事件委託
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        
        // 搜尋防抖
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                this.debounce(this.handleSearch.bind(this), 300)
            );
        }
    }
    
    handleGlobalClick(event) {
        const target = event.target;
        
        // 狀態篩選
        if (target.matches('.tab-btn')) {
            const status = target.dataset.status;
            this.filterByStatus(status);
        }
        
        // 其他點擊事件...
    }
    
    // 防抖函數
    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // 搜尋處理
    handleSearch() {
        const query = this.elements.searchInput.value.toLowerCase().trim();
        
        if (!query) {
            this.displayProjects(this.allProjects);
            return;
        }
        
        const filtered = this.allProjects.filter(project => 
            project.name.toLowerCase().includes(query) ||
            (project.company && project.company.toLowerCase().includes(query))
        );
        
        this.displayProjects(filtered);
    }
    
    // 狀態篩選
    filterByStatus(status) {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => btn.classList.remove('active'));
        
        const activeTab = document.querySelector(`[data-status="${status}"]`);
        if (activeTab) activeTab.classList.add('active');
        
        let filtered;
        if (status === 'all') {
            filtered = this.allProjects;
        } else {
            filtered = this.allProjects.filter(project => {
                const projectStatus = project.calculated_status || project.project_status;
                return status === 'not_started' ? 
                    (!projectStatus || projectStatus === 'not_started') :
                    projectStatus === status;
            });
        }
        
        this.displayProjects(filtered);
        this.updateStatsFromLocal(filtered);
    }
    
    // UI 狀態管理
    showLoading() {
        if (this.elements.loading) {
            this.elements.loading.style.display = 'flex';
        }
    }
    
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.style.display = 'none';
        }
    }
    
    updateContainerVisibility(hasProjects) {
        if (this.elements.projectsContainer) {
            this.elements.projectsContainer.style.display = hasProjects ? 'block' : 'none';
        }
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = hasProjects ? 'none' : 'block';
        }
    }
    
    showError(message) {
        console.error(message);
        // 可以實現錯誤 UI 顯示
    }
    
    // 性能監控
    reportPerformance() {
        const loadTime = performance.now() - this.loadStartTime;
        console.log(`頁面載入完成: ${loadTime.toFixed(2)}ms`);
        
        // 記錄到分析服務（可選）
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_load_time', {
                event_category: 'Performance',
                value: Math.round(loadTime)
            });
        }
    }
    
    // 其他輔助方法...
    async loadUserInfo() {
        if (!AuthUtils.requireAuth('login-simple.html')) return;
        
        this.currentUser = AuthUtils.getUser();
        await this.checkAdminPermissions();
        
        // 初始化用戶組件
        this.initUserProfile();
    }
    
    async checkAdminPermissions() {
        // 優化的權限檢查
        if (window.permissions) {
            await window.permissions.init();
            const isAdmin = await window.permissions.isAdmin();
            
            const adminMenu = document.getElementById('adminMenu');
            if (adminMenu && isAdmin) {
                adminMenu.style.display = 'block';
            }
        }
    }
    
    initUserProfile() {
        const headerRightSection = document.querySelector('.header-right-section');
        if (headerRightSection && window.initUserProfile) {
            window.initUserProfile({
                showRole: true,
                showProfile: true,
                container: headerRightSection,
                displayMode: 'name-only'
            });
        }
    }
    
    updateStats(stats) {
        if (!stats || !stats.by_status) {
            this.updateStatsFromLocal();
            return;
        }
        
        const updates = {
            totalProjects: stats.total,
            notStartedProjects: stats.by_status.not_started,
            inProgressProjects: stats.by_status.in_progress,
            completedProjects: stats.by_status.completed,
            maintenanceProjects: stats.by_status.maintenance
        };
        
        Object.entries(updates).forEach(([id, value]) => {
            const element = this.elements[id];
            if (element) element.textContent = value;
        });
    }
    
    updateStatsFromLocal(projects = this.allProjects) {
        const stats = this.calculateStats(projects);
        
        Object.entries(stats).forEach(([key, value]) => {
            const element = this.elements[key];
            if (element) element.textContent = value;
        });
    }
    
    calculateStats(projects) {
        return {
            totalProjects: projects.length,
            notStartedProjects: projects.filter(p => {
                const status = p.calculated_status || p.project_status;
                return !status || status === 'not_started';
            }).length,
            inProgressProjects: projects.filter(p => {
                const status = p.calculated_status || p.project_status;
                return status === 'in_progress';
            }).length,
            completedProjects: projects.filter(p => {
                const status = p.calculated_status || p.project_status;
                return status === 'completed';
            }).length,
            maintenanceProjects: projects.filter(p => {
                const status = p.calculated_status || p.project_status;
                return status === 'maintenance';
            }).length
        };
    }
}

// 全域初始化
let projectListApp;

document.addEventListener('DOMContentLoaded', function() {
    projectListApp = new OptimizedProjectList();
    projectListApp.init().catch(console.error);
});

// 導出給其他腳本使用
window.ProjectListApp = OptimizedProjectList;