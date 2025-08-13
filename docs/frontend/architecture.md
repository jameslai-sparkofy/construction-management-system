# 前端架構設計

## 🎨 技術選型

### 核心技術
- **基礎**: HTML5 + CSS3 + Vanilla JavaScript
- **UI 框架**: 無 (輕量化設計)
- **打包工具**: 無 (直接部署)
- **部署平台**: Cloudflare Pages

### 選型理由
1. **快速載入**: 無框架開銷，首屏載入極速
2. **易於維護**: 程式碼簡潔，無複雜依賴
3. **跨裝置相容**: 原生 Web 技術，相容性佳
4. **SEO 友善**: 純 HTML，搜尋引擎最佳化

## 📁 檔案結構

```
frontend/
├── index.html              # 首頁/登入頁
├── project-list.html       # 專案列表
├── project-detail-v5-final.html  # 專案詳情頁
├── project-create-v2.html  # 專案建立頁
├── config.js              # 配置檔案
├── js/
│   └── api-client.js      # API 呼叫封裝
├── css/
│   ├── global.css         # 全域樣式
│   ├── components.css     # 元件樣式
│   └── responsive.css     # 響應式設計
├── assets/
│   ├── images/           # 圖片資源
│   └── icons/            # 圖示資源
├── _headers              # Cloudflare Pages headers
├── _routes.json          # 路由配置
└── functions/            # Edge Functions
    └── api/              # API Proxy
```

## 🔧 核心模組設計

### 1. 配置管理 (config.js)
```javascript
const CONFIG = {
    API: {
        WORKER_API_URL: 'https://api.yes-ceramics.com',
        CRM_API_URL: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
        API_VERSION: 'v1'
    },
    ENV: {
        ENVIRONMENT: 'production',
        DEBUG: false,
        LOG_LEVEL: 'error'
    },
    APP: {
        NAME: '元心建材工程管理系統',
        VERSION: '1.0.0',
        SESSION_DURATION: 24,
        MAX_FILE_SIZE: 10,
        PAGE_SIZE: 20
    }
};
```

### 2. API 客戶端 (js/api-client.js)
```javascript
const API = {
    // 統一的 API 請求方法
    async request(method, endpoint, data = null) {
        const url = this.getUrl(endpoint);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders()
            }
        };
        
        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'API 請求失敗');
            }
            
            return result;
        } catch (error) {
            Logger.error('API Error:', error);
            throw error;
        }
    },
    
    // 便捷方法
    get: (endpoint) => API.request('GET', endpoint),
    post: (endpoint, data) => API.request('POST', endpoint, data),
    put: (endpoint, data) => API.request('PUT', endpoint, data),
    delete: (endpoint) => API.request('DELETE', endpoint)
};
```

### 3. 日誌系統 (Logger)
```javascript
const Logger = {
    debug: (...args) => {
        if (CONFIG.ENV.LOG_LEVEL === 'debug') {
            console.log('[DEBUG]', ...args);
        }
    },
    info: (...args) => {
        if (['debug', 'info'].includes(CONFIG.ENV.LOG_LEVEL)) {
            console.info('[INFO]', ...args);
        }
    },
    error: (...args) => {
        console.error('[ERROR]', ...args);
    }
};
```

## 📱 頁面架構

### 1. 專案詳情頁 (project-detail-v5-final.html)

#### 功能模組
```javascript
// 頁面控制器
const ProjectDetailController = {
    projectId: null,
    projectData: null,
    currentView: 'construction', // construction, repair, announcement, team, files, report
    
    // 初始化
    async init() {
        this.projectId = this.getProjectIdFromURL();
        await this.loadProjectData();
        this.setupEventListeners();
        this.renderPage();
    },
    
    // 載入專案資料
    async loadProjectData() {
        try {
            this.projectData = await API.get(`/projects/${this.projectId}`);
            this.updatePageTitle();
            this.updateStatistics();
        } catch (error) {
            this.showError('載入專案資料失敗', error.message);
        }
    },
    
    // 切換檢視
    switchView(viewName) {
        this.currentView = viewName;
        this.updateActiveTab();
        this.renderViewContent();
    }
};
```

#### 響應式設計
```css
/* 桌面版 */
@media (min-width: 1024px) {
    .project-layout {
        display: grid;
        grid-template-columns: 250px 1fr;
        gap: 20px;
    }
}

/* 平板版 */
@media (min-width: 768px) and (max-width: 1023px) {
    .project-layout {
        display: flex;
        flex-direction: column;
    }
    
    .sidebar {
        position: sticky;
        top: 0;
    }
}

/* 手機版 */
@media (max-width: 767px) {
    .project-header {
        padding: 10px;
        font-size: 14px;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .building-tabs {
        overflow-x: auto;
        scrollbar-width: none;
    }
}
```

### 2. 專案建立頁 (project-create-v2.html)

#### 多步驟表單
```javascript
const CreateProjectWizard = {
    currentStep: 1,
    totalSteps: 4,
    formData: {},
    
    steps: [
        { id: 1, name: '選擇商機', component: 'OpportunitySelector' },
        { id: 2, name: '選擇工程類型', component: 'EngineeringTypeSelector' },
        { id: 3, name: '顯示統計', component: 'StatisticsDisplay' },
        { id: 4, name: '設定權限', component: 'PermissionSettings' }
    ],
    
    // 下一步
    async nextStep() {
        if (await this.validateCurrentStep()) {
            this.currentStep++;
            this.updateProgressBar();
            this.renderCurrentStep();
        }
    },
    
    // 上一步
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateProgressBar();
            this.renderCurrentStep();
        }
    },
    
    // 提交表單
    async submitForm() {
        try {
            const projectData = this.buildProjectData();
            const result = await API.post('/projects', projectData);
            this.showSuccess('專案建立成功！');
            this.redirectToProject(result.projectId);
        } catch (error) {
            this.showError('專案建立失敗', error.message);
        }
    }
};
```

## 🎨 UI/UX 設計原則

### 1. 設計語言
- **色彩**: 企業藍 (#2563eb) + 輔助色系
- **字體**: 
  - 中文: PingFang SC, Microsoft YaHei
  - 英文: Inter, Helvetica Neue
- **間距**: 4px 基數系統 (4, 8, 12, 16, 20, 24...)
- **圓角**: 4px (小元件) / 8px (卡片) / 12px (模態框)

### 2. 元件系統
```css
/* 按鈕系統 */
.btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary { background: #2563eb; color: white; }
.btn-secondary { background: #6b7280; color: white; }
.btn-danger { background: #dc2626; color: white; }

/* 卡片系統 */
.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 20px;
}

/* 表單系統 */
.form-group {
    margin-bottom: 16px;
}

.form-label {
    display: block;
    font-weight: 500;
    margin-bottom: 4px;
    color: #374151;
}

.form-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
}
```

### 3. 互動設計
- **載入狀態**: 骨架屏 + 載入指示器
- **錯誤處理**: Toast 通知 + 表單驗證
- **確認操作**: 模態框確認
- **即時回饋**: 按鈕狀態變化

## 📱 行動端適配

### PWA 支援
```html
<!-- manifest.json -->
{
    "name": "元心建材工程管理系統",
    "short_name": "元心工程",
    "theme_color": "#2563eb",
    "background_color": "#ffffff",
    "display": "standalone",
    "start_url": "/",
    "icons": [
        {
            "src": "icons/icon-192x192.png",
            "sizes": "192x192",
            "type": "image/png"
        }
    ]
}
```

### 觸控優化
```css
/* 觸控目標最小 44px */
.touch-target {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 手勢支援 */
.swipe-container {
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
}

/* 防止點擊延遲 */
.no-tap-delay {
    touch-action: manipulation;
}
```

## 🚀 效能最佳化

### 1. 載入最佳化
- **關鍵資源**: 內聯關鍵 CSS
- **懶載入**: 圖片和非關鍵腳本
- **預載入**: 下一頁可能需要的資源
- **快取策略**: Service Worker 快取

### 2. 資料快取
```javascript
const CacheManager = {
    // 記憶體快取
    memoryCache: new Map(),
    
    // 設定快取
    set(key, data, ttl = 300000) { // 5分鐘預設
        this.memoryCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    },
    
    // 取得快取
    get(key) {
        const cached = this.memoryCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.memoryCache.delete(key);
            return null;
        }
        
        return cached.data;
    }
};
```

### 3. 圖片最佳化
```html
<!-- 響應式圖片 -->
<picture>
    <source media="(min-width: 768px)" srcset="image-desktop.webp">
    <source media="(max-width: 767px)" srcset="image-mobile.webp">
    <img src="image-fallback.jpg" alt="專案圖片" loading="lazy">
</picture>
```

## 🔍 SEO 最佳化

### Meta 標籤
```html
<head>
    <title>專案詳情 - 興安西 | 元心建材工程管理系統</title>
    <meta name="description" content="查看興安西專案的施工進度、工班分配和完工狀況">
    <meta property="og:title" content="專案詳情 - 興安西">
    <meta property="og:description" content="即時追蹤專案進度">
    <meta property="og:type" content="website">
</head>
```

### 結構化資料
```html
<script type="application/ld+json">
{
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "元心建材工程管理系統",
    "applicationCategory": "BusinessApplication"
}
</script>
```

---

**最後更新**: 2025-08-11  
**技術版本**: HTML5 + ES2020  
**線上展示**: 待部署