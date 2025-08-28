# project-create.html - 詳細技術分析

## 🎯 頁面概述

`project-create.html` 是系統中**最複雜的頁面之一**，實現了四步驟的項目創建流程，整合了多個外部系統和複雜的業務邏輯。

## 📋 四步驟創建流程

### 步驟 1: 選擇商機 (Select Opportunity)
```javascript
// 功能實現
├── CRM 商機數據載入
│   ├── API: GET /api/v1/opportunities
│   ├── 實時搜尋過濾
│   └── 分頁載入優化
├── 搜尋功能
│   ├── 公司名稱搜尋
│   ├── 商機名稱搜尋
│   └── 即時過濾結果
├── 商機選擇
│   ├── 單選模式
│   ├── 選中狀態管理
│   └── 詳情預覽
└── 驗證機制
    ├── 必須選擇商機
    ├── 商機狀態檢查
    └── 啟用下一步按鈕
```

**關鍵代碼邏輯**:
```javascript
async function loadOpportunities() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/opportunities`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const opportunities = await response.json();
        renderOpportunitiesGrid(opportunities.data);
        
        // 設置搜尋功能
        setupOpportunitySearch();
        
    } catch (error) {
        console.error('Failed to load opportunities:', error);
        showErrorMessage('無法載入商機數據');
    }
}

function selectOpportunity(opportunityId) {
    window.selectedOpportunity = opportunityId;
    
    // 更新 UI 選中狀態
    updateOpportunitySelection(opportunityId);
    
    // 啟用下一步按鈕
    document.getElementById('step1-next').disabled = false;
}
```

### 步驟 2: 選擇工程類型 (Select Engineering Types)
```javascript
// 工程類型管理
├── 動態類型載入
│   ├── SPC 石塑地板工程
│   ├── 浴櫃工程  
│   ├── 磁磚工程
│   └── 自定義類型支持
├── 視覺化選擇
│   ├── 圖示展示
│   ├── 描述文字
│   └── 選擇動畫效果
├── 選擇限制
│   ├── 單選模式 (重要！)
│   ├── 互斥選擇
│   └── 選擇確認
└── 數據結構
    ├── 類型代碼 (SPC, CABINET等)
    ├── 顯示名稱
    └── 詳細描述
```

**工程類型數據結構**:
```javascript
const engineeringTypes = [
    {
        code: 'SPC',
        name: 'SPC 石塑地板',
        description: '石塑複合地板工程',
        icon: '🏗️',
        estimatedDuration: '5-10天',
        requiresSpecialty: true
    },
    {
        code: 'CABINET',
        name: '浴櫃工程',
        description: '浴室櫃體安裝工程', 
        icon: '🚿',
        estimatedDuration: '3-7天',
        requiresSpecialty: false
    }
];
```

### 步驟 3: 顯示統計 (Display Statistics)
```javascript
// 自動統計計算
├── 工程數據分析
│   ├── 預估工期計算
│   ├── 資源需求評估
│   ├── 成本預算分析
│   └── 風險評估報告
├── 數據視覺化
│   ├── 進度時間軸
│   ├── 資源分配圖
│   ├── 成本結構圖
│   └── 風險熱力圖
├── 動態更新
│   ├── 基於步驟1和2的選擇
│   ├── 實時重新計算
│   └── 異步載入顯示
└── 報表生成
    ├── PDF 報表導出
    ├── Excel 數據匯出
    └── 分享連結生成
```

**統計計算邏輯**:
```javascript
async function loadStatistics() {
    const statisticsData = {
        opportunityId: selectedOpportunity,
        engineeringTypes: selectedEngineeringTypes,
        calculationDate: new Date().toISOString()
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/v1/statistics/calculate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(statisticsData)
        });
        
        const stats = await response.json();
        renderStatisticsDisplay(stats.data);
        
    } catch (error) {
        console.error('Failed to load statistics:', error);
        showFallbackStatistics();
    }
}

function renderStatisticsDisplay(stats) {
    const container = document.getElementById('statisticsContent');
    container.innerHTML = `
        <div class="statistics-grid">
            <div class="stat-card">
                <h3>預估工期</h3>
                <div class="stat-value">${stats.estimatedDuration} 天</div>
            </div>
            <div class="stat-card">
                <h3>所需工班</h3>
                <div class="stat-value">${stats.requiredTeams} 個</div>
            </div>
            <div class="stat-card">
                <h3>預估成本</h3>
                <div class="stat-value">NT$ ${stats.estimatedCost.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <h3>風險等級</h3>
                <div class="stat-value risk-${stats.riskLevel.toLowerCase()}">${stats.riskLevel}</div>
            </div>
        </div>
        <div class="timeline-chart">
            ${renderTimelineChart(stats.timeline)}
        </div>
    `;
}
```

### 步驟 4: 設定權限 (Set Permissions) - **最複雜部分**
```javascript
// 權限配置系統
├── 業主權限設定
│   ├── 數據源: newopportunitycontactsobj (CRM)
│   ├── 多選業主支持
│   ├── 聯繫方式驗證
│   └── 權限等級分配
├── 管理員配置  
│   ├── 數據源: employees_simple (內部員工)
│   ├── 管理權限分級
│   │   ├── 專案管理員
│   │   ├── 區域負責人
│   │   └── 現場監督
│   └── 審核流程設定
├── 工班配置
│   ├── 工班類型對應
│   │   ├── SPC工班 ↔ SPC工程
│   │   ├── 浴櫃工班 ↔ 浴櫃工程
│   │   └── 通用工班
│   ├── 負責人指派
│   ├── 成員權限設定
│   └── 工作區域劃分
└── 認證系統整合
    ├── Supabase 自動建帳
    ├── 密碼策略 (手機後3碼)
    ├── 認證映射建立
    └── 權限同步機制
```

**Supabase 認證整合**:
```javascript
// 為新用戶自動創建認證帳號
async function createSupabaseUser(userData) {
    const { phone, name, role, d1_user_id } = userData;
    const password = phone.slice(-3); // 密碼為電話末3碼
    
    try {
        // 創建 Supabase 認證用戶
        const { data, error } = await window.supabase.auth.signUp({
            email: `${phone}@construction.local`, // 虛擬 email
            password: password,
            options: {
                data: {
                    display_name: name,
                    phone: phone,
                    role: role,
                    d1_user_id: d1_user_id
                }
            }
        });
        
        if (error) throw error;
        
        // 創建認證映射
        await createAuthMapping(data.user.id, d1_user_id, phone);
        
        console.log(`✅ Created Supabase user for ${name} (${phone})`);
        return data.user;
        
    } catch (error) {
        console.error(`❌ Failed to create Supabase user for ${name}:`, error);
        throw error;
    }
}

// 建立 D1 和 Supabase 認證的映射關係
async function createAuthMapping(authUserId, d1UserId, phone) {
    if (window.supabase) {
        const { error } = await window.supabase
            .from('auth_mapping')
            .upsert({
                auth_user_id: authUserId,
                d1_user_id: d1UserId,
                d1_user_phone: phone,
                last_synced_at: new Date().toISOString()
            });
            
        if (error) {
            console.error('Failed to create auth mapping:', error);
        }
    }
}
```

## 🔧 技術架構特點

### 1. 步驟導航系統
```javascript
class StepNavigator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.stepData = {};
    }
    
    async nextStep() {
        // 驗證當前步驟
        if (!await this.validateCurrentStep()) {
            return false;
        }
        
        // 保存當前步驟數據
        this.saveStepData();
        
        // 標記步驟完成
        this.markStepCompleted(this.currentStep);
        
        // 移到下一步
        this.currentStep++;
        this.showStep(this.currentStep);
        
        // 載入下一步數據
        await this.loadStepData(this.currentStep);
        
        return true;
    }
    
    async validateCurrentStep() {
        const validators = {
            1: () => window.selectedOpportunity !== null,
            2: () => window.selectedEngineeringTypes.length > 0,
            3: () => this.statisticsLoaded,
            4: () => this.validatePermissionSettings()
        };
        
        return validators[this.currentStep]();
    }
}
```

### 2. 數據狀態管理
```javascript
// 全域狀態管理
const ProjectCreationState = {
    // 步驟1數據
    selectedOpportunity: null,
    opportunityDetails: null,
    
    // 步驟2數據
    selectedEngineeringTypes: [],
    availableTypes: [],
    
    // 步驟3數據
    statistics: null,
    calculatedMetrics: null,
    
    // 步驟4數據
    selectedOwners: [],
    selectedAdmins: [],
    teamConfigurations: [],
    
    // 元數據
    isEditMode: false,
    editingProjectId: null,
    
    // 方法
    reset() {
        Object.keys(this).forEach(key => {
            if (typeof this[key] !== 'function') {
                this[key] = Array.isArray(this[key]) ? [] : null;
            }
        });
    },
    
    serialize() {
        return JSON.stringify({
            selectedOpportunity: this.selectedOpportunity,
            selectedEngineeringTypes: this.selectedEngineeringTypes,
            selectedOwners: this.selectedOwners,
            selectedAdmins: this.selectedAdmins,
            teamConfigurations: this.teamConfigurations
        });
    }
};
```

### 3. API 整合架構
```javascript
// API 端點管理
const ProjectCreateAPI = {
    // CRM 相關
    opportunities: {
        list: () => `${API_BASE}/api/v1/opportunities`,
        details: (id) => `${API_BASE}/api/v1/opportunities/${id}`
    },
    
    // 工程類型
    engineeringTypes: {
        list: () => `${API_BASE}/api/v1/engineering-types`,
        statistics: () => `${API_BASE}/api/v1/engineering-types/statistics`
    },
    
    // 統計計算
    statistics: {
        calculate: () => `${API_BASE}/api/v1/statistics/calculate`,
        preview: () => `${API_BASE}/api/v1/statistics/preview`
    },
    
    // 權限管理
    permissions: {
        owners: () => `${API_BASE}/api/v1/users/available/owners`,
        admins: () => `${API_BASE}/api/v1/users/available/admins`,
        teams: () => `${API_BASE}/api/v1/teams`
    },
    
    // 項目創建
    projects: {
        create: () => `${API_BASE}/api/v1/projects`,
        update: (id) => `${API_BASE}/api/v1/projects/${id}`
    }
};
```

### 4. 錯誤處理與重試機制
```javascript
// API 調用包裝器
async function apiCall(endpoint, options = {}) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            retryCount++;
            console.warn(`API call failed (attempt ${retryCount}/${maxRetries}):`, error.message);
            
            if (retryCount >= maxRetries) {
                throw error;
            }
            
            // 指數退避策略
            await new Promise(resolve => 
                setTimeout(resolve, Math.pow(2, retryCount) * 1000)
            );
        }
    }
}
```

## 🎨 UI/UX 設計特點

### 1. 進度指示器
```css
/* 步驟進度視覺化 */
.progress-steps {
    display: flex;
    justify-content: space-between;
    position: relative;
}

.progress-steps::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 0;
    right: 0;
    height: 2px;
    background: #e5e7eb;
    z-index: 1;
}

.step.completed .step-number {
    background: #10b981; /* 綠色完成狀態 */
    color: white;
    transform: scale(1.1);
}

.step.active .step-number {
    background: #4f46e5; /* 藍色進行中 */
    color: white;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2);
}
```

### 2. 響應式設計
```css
/* 桌面版布局 */
@media (min-width: 1024px) {
    .container {
        max-width: 1200px;
        padding: 2.5rem;
    }
    
    .engineering-types-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

/* 平板版布局 */
@media (max-width: 1023px) and (min-width: 768px) {
    .engineering-types-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* 手機版布局 */
@media (max-width: 767px) {
    .container {
        padding: 1rem;
    }
    
    .progress-steps {
        flex-direction: column;
        gap: 1rem;
    }
    
    .engineering-types-grid {
        grid-template-columns: 1fr;
    }
}
```

### 3. 動畫與過渡效果
```css
/* 步驟切換動畫 */
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.step-content.active {
    animation: fadeIn 0.3s ease;
}

/* 選擇項目動畫 */
.engineering-type-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.engineering-type-card.selected {
    border-color: #4f46e5;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    transform: scale(1.02);
}
```

## 🚨 常見問題與解決方案

### 1. CRM 數據載入失敗
```javascript
// 問題：CRM API 響應慢或失敗
// 解決：實現降級策略

async function loadOpportunitiesWithFallback() {
    try {
        // 嘗試載入 CRM 數據
        const crmData = await loadFromCRM();
        return crmData;
        
    } catch (crmError) {
        console.warn('CRM failed, using cached data:', crmError);
        
        // 降級到緩存數據
        const cachedData = localStorage.getItem('cached_opportunities');
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        
        // 最終降級到預設數據
        return getDefaultOpportunities();
    }
}
```

### 2. 步驟間數據同步問題
```javascript
// 問題：步驟間數據丟失
// 解決：實現數據持久化

const StepDataPersistence = {
    save(stepNumber, data) {
        const key = `project_create_step_${stepNumber}`;
        localStorage.setItem(key, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    },
    
    load(stepNumber) {
        const key = `project_create_step_${stepNumber}`;
        const stored = localStorage.getItem(key);
        
        if (!stored) return null;
        
        const parsed = JSON.parse(stored);
        
        // 檢查數據新鮮度 (30分鐘)
        if (Date.now() - parsed.timestamp > 30 * 60 * 1000) {
            this.clear(stepNumber);
            return null;
        }
        
        return parsed.data;
    },
    
    clear(stepNumber) {
        const key = `project_create_step_${stepNumber}`;
        localStorage.removeItem(key);
    },
    
    clearAll() {
        for (let i = 1; i <= 4; i++) {
            this.clear(i);
        }
    }
};
```

### 3. 權限設定複雜度管理
```javascript
// 問題：第四步權限設定過於複雜
// 解決：實現權限模板系統

const PermissionTemplates = {
    // 標準模板
    standard: {
        name: '標準專案',
        description: '適用於一般建築工程',
        settings: {
            owners: { maxCount: 2, permissions: ['view', 'approve'] },
            admins: { maxCount: 1, permissions: ['manage', 'edit', 'view'] },
            teams: { autoAssign: true, permissions: ['execute', 'report'] }
        }
    },
    
    // 大型項目模板
    enterprise: {
        name: '大型專案',
        description: '適用於複雜大型工程',
        settings: {
            owners: { maxCount: 5, permissions: ['view', 'approve', 'audit'] },
            admins: { maxCount: 3, permissions: ['manage', 'edit', 'view', 'delegate'] },
            teams: { autoAssign: false, permissions: ['execute', 'report', 'coordinate'] }
        }
    },
    
    // 應用模板
    apply(templateName) {
        const template = this[templateName];
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        
        // 應用模板設定到當前表單
        this.applyToForm(template.settings);
        
        return template;
    },
    
    applyToForm(settings) {
        // 設定業主數量限制
        const ownerSelect = document.getElementById('projectOwners');
        ownerSelect.setAttribute('data-max-count', settings.owners.maxCount);
        
        // 設定管理員權限
        const adminCheckboxes = document.querySelectorAll('[name="adminPermissions"]');
        adminCheckboxes.forEach(checkbox => {
            checkbox.checked = settings.admins.permissions.includes(checkbox.value);
        });
        
        // 設定工班配置
        const autoAssignCheckbox = document.getElementById('autoAssignTeams');
        autoAssignCheckbox.checked = settings.teams.autoAssign;
    }
};
```

## 📊 性能優化建議

### 1. 數據預載入
```javascript
// 在用戶瀏覽其他步驟時預載入數據
const PreloadManager = {
    preloadQueue: [],
    
    async preloadNextStepData(currentStep) {
        const nextStep = currentStep + 1;
        if (nextStep > 4) return;
        
        const preloadTasks = {
            2: () => this.preloadEngineeringTypes(),
            3: () => this.preloadStatistics(),
            4: () => this.preloadPermissions()
        };
        
        const task = preloadTasks[nextStep];
        if (task) {
            // 在背景執行預載入
            task().catch(error => 
                console.warn(`Preload failed for step ${nextStep}:`, error)
            );
        }
    }
};
```

### 2. 圖片優化
```html
<!-- 工程類型圖示使用 WebP 格式 -->
<picture>
    <source srcset="images/spc-engineering.webp" type="image/webp">
    <img src="images/spc-engineering.jpg" alt="SPC 工程" loading="lazy">
</picture>
```

### 3. 代碼分割
```javascript
// 動態載入非關鍵功能
async function loadAdvancedFeatures() {
    if (userNeedsAdvanced) {
        const { AdvancedStatistics } = await import('./modules/advanced-stats.js');
        return new AdvancedStatistics();
    }
}
```

---

`project-create.html` 是系統中技術含量最高的頁面之一，整合了多個外部系統，實現了複雜的業務流程，是新工程師需要深入理解的核心頁面！