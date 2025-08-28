# 工程管理系統 - 頁面架構詳解

## 📱 頁面總覽

系統目前包含 **22個主要頁面**，分為以下幾個功能模組：
- **核心業務頁面** (5個)
- **用戶管理頁面** (7個) 
- **管理員工具頁面** (6個)
- **測試與工具頁面** (4個)

---

## 🏠 核心業務頁面

### 1. index.html - 系統首頁
**功能**: 系統入口頁面
```
用途: 系統歡迎頁面，可能包含導航到其他主要功能
用戶: 所有用戶
權限: 公開訪問
導航: 通常導向登入頁面或儀表板
```

### 2. login-simple.html - 用戶登入
**功能**: 用戶身份驗證
```javascript
// 登入流程
1. 用戶輸入手機號碼和密碼
2. 前端驗證輸入格式
3. 調用 API: POST /api/v1/auth/login
4. 成功後存儲 token 和用戶信息到 localStorage
5. 重定向到 project-list.html
```
**特點**:
- 簡化的登入界面
- 支援手機號碼登入
- 自動保存登入狀態

### 3. project-list.html - 項目列表頁
**功能**: 顯示用戶可存取的所有項目
```javascript
// 頁面架構
├── 用戶資料組件 (user-profile-component.js)
├── 項目篩選器 (狀態、日期)
├── 項目卡片列表
│   ├── 項目名稱和描述
│   ├── 進度指示器
│   ├── 工班數量統計
│   └── 快速操作按鈕
└── 新增項目按鈕 (管理員限定)
```
**API 調用**:
- `GET /api/v1/projects` - 取得項目列表
- 根據用戶角色過濾顯示內容

### 4. project-detail.html - 項目詳情頁
**功能**: 顯示單一項目的詳細信息和操作
```javascript
// 頁面結構
├── 項目基本信息
│   ├── 項目名稱、描述
│   ├── 開始/結束日期
│   └── 項目狀態
├── 工班管理區塊
│   ├── 工班列表
│   ├── 成員統計
│   └── 工班進度
├── 日誌管理
│   ├── 每日工作記錄
│   ├── 照片上傳
│   └── 進度更新
└── 快速導航
    ├── 用戶管理
    ├── 工班設置
    └── 報表查看
```
**權限控制**:
- 管理員：完整編輯權限
- 業主：查看權限
- 工班負責人：管理自己工班
- 工班成員：查看指派任務

### 5. daily-log-share.html - 日誌分享頁
**功能**: 公開分享工程進度
```javascript
// 特殊設計
├── 無需登入即可查看
├── 響應式設計 (支援手機查看)
├── 工程照片展示
├── 進度時間軸
└── 分享連結功能
```
**URL 格式**: `?project_id=xxx&date=yyyy-mm-dd`

---

## 👥 用戶管理頁面

### 6. project-user-management.html - 核心用戶管理頁
**功能**: 項目級別的用戶權限管理 (我們主要修復的頁面)
```javascript
// 複雜的頁面架構
├── 左側面板 - 添加用戶到專案
│   ├── 用戶類型標籤 (管理員/師父/業主)
│   ├── 用戶選擇列表
│   │   ├── 管理員: 從 employees_simple 載入
│   │   ├── 師父: 從 object_50hj8__c 載入
│   │   └── 業主: 從 newopportunitycontactsobj 載入
│   ├── 角色選擇器 (負責人/成員)
│   ├── 工班選擇器
│   └── 添加按鈕
└── 右側面板 - 專案成員列表
    ├── 管理員列表 (僅管理員可見)
    ├── 業主列表
    └── 工班成員列表
        ├── 按工班分組顯示
        ├── 角色切換開關
        ├── 移除按鈕
        └── 退回到工地師父按鈕
```

**權限邏輯**:
```javascript
// 依用戶角色顯示不同內容
if (user.type === 'admin') {
    // 管理員: 看到所有功能
    showAllTabs();
    showAllOperations();
} else if (user.type === 'worker' && user.role === 'leader') {
    // 工班負責人: 只能管理自己工班
    hideAdminTabs();
    filterToOwnTeam();
    showTeamManagementButtons();
} else {
    // 其他用戶: 只能查看或無權限
    redirectToProjectDetail();
}
```

### 7. global-user-management.html - 全域用戶管理
**功能**: 系統級別的用戶管理 (管理員專用)
```javascript
// 功能範圍
├── 查看所有系統用戶
├── 創建新用戶帳號
├── 修改用戶基本信息
├── 重設用戶密碼
├── 停用/啟用用戶
└── 批量操作功能
```

### 8. global-project-user-management.html - 全域項目用戶管理
**功能**: 跨項目的用戶權限統一管理
```javascript
// 適用場景
├── 用戶參與多個項目時的權限統一設定
├── 批量分配用戶到多個項目
├── 權限模板應用
└── 跨項目數據遷移
```

### 9. member-management.html - 工班成員管理
**功能**: 專門管理工班內部成員
```javascript
// 工班負責人專用功能
├── 成員技能標籤管理
├── 工作排班設定
├── 成員績效記錄
├── 任務分配
└── 成員出勤統計
```

### 10. owner-management.html - 業主管理
**功能**: 專門管理項目業主
```javascript
// 業主相關管理
├── 業主聯繫信息
├── 決策權限設定
├── 溝通記錄
├── 變更審核流程
└── 付款狀態追蹤
```

### 11. team-member-management.html - 工班成員詳細管理
**功能**: 更細緻的工班成員管理功能

### 12. user-profile.html - 用戶個人資料
**功能**: 用戶個人資料編輯和設定
```javascript
// 個人設定功能
├── 基本資料編輯 (姓名、電話、email)
├── 密碼修改
├── 頭像上傳
├── 通知偏好設定
├── 語言選擇
└── 帳號安全設定
```

---

## 🛠️ 管理員工具頁面

### 13. super-admin-users.html - 超級管理員用戶管理
**功能**: 最高權限的用戶管理界面
```javascript
// 超級管理員專屬功能
├── 系統用戶完整 CRUD
├── 權限等級設定
├── 系統日誌查看
├── 數據導入/導出
├── 系統健康檢查
└── 緊急操作功能
```

### 14. project-create.html - 項目創建 ⭐⭐⭐⭐⭐
**功能**: 複雜的四步驟項目創建流程 (高複雜度頁面)
```javascript
// 四步驟創建流程
步驟1: 選擇商機 (Select Opportunity)
├── 從 CRM 系統載入商機列表
├── 搜尋過濾功能
├── 商機詳情預覽
└── 商機選擇驗證

步驟2: 選擇工程類型 (Select Engineering Types)
├── 動態載入工程類型
│   ├── SPC 石塑地板工程
│   ├── 浴櫃工程
│   └── 其他自定義類型
├── 單選模式 (與多選不同)
├── 工程類型圖示和描述
└── 類型選擇驗證

步驟3: 顯示統計 (Display Statistics)
├── 自動計算工程統計
├── 預估工期和成本
├── 資源需求分析
├── 風險評估報告
└── 數據視覺化圖表

步驟4: 設定權限 (Set Permissions)
├── 業主權限配置
│   ├── 從 newopportunitycontactsobj 載入
│   ├── 多選業主支持
│   └── 權限等級設定
├── 管理員配置
│   ├── 從 employees_simple 載入
│   ├── 管理權限分配
│   └── 審核流程設定
├── 工班配置
│   ├── 工班類型對應
│   ├── 負責人指派
│   └── 成員權限設定
└── Supabase 認證整合
    ├── 自動創建用戶帳號
    ├── 密碼自動生成 (手機後3碼)
    └── 認證映射建立
```

**技術特點**:
```javascript
// 步驟導航系統
class StepNavigator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
    }
    
    nextStep() {
        // 標記當前步驟完成
        this.markStepCompleted(this.currentStep);
        // 載入下一步驟數據
        this.loadStepData(this.currentStep + 1);
    }
}

// 數據預載入策略
async function init() {
    // 並行載入多個數據源
    await Promise.all([
        loadEngineeringTypes(),  // 工程類型
        loadTeams(),            // 工班資料
        loadOpportunities()     // CRM 商機
    ]);
}

// 複雜的API整合
const API_ENDPOINTS = {
    opportunities: '/api/v1/opportunities',     // CRM商機
    engineeringTypes: '/api/v1/engineering-types', // 工程類型
    statistics: '/api/v1/statistics',           // 統計數據
    permissions: '/api/v1/permissions'          // 權限配置
};
```

**表單驗證機制**:
```javascript
// 每步驟的驗證規則
const VALIDATION_RULES = {
    step1: () => selectedOpportunity !== null,
    step2: () => selectedEngineeringTypes.length > 0,
    step3: () => statisticsLoaded && !hasErrors,
    step4: () => validatePermissionSettings()
};

// 動態按鈕狀態控制
function updateButtonStates() {
    const nextBtn = document.getElementById(`step${currentStep}-next`);
    nextBtn.disabled = !VALIDATION_RULES[`step${currentStep}`]();
}
```

**編輯模式支持**:
- URL 參數檢測: `?project_id=xxx` 進入編輯模式
- 數據預填充: 從現有項目載入所有設定
- 更新vs創建: 動態切換 API 端點和按鈕文字

### 15. project-create-simple.html - 簡化項目創建
**功能**: 快速創建項目的簡化界面

### 16. project-edit.html - 項目編輯
**功能**: 修改現有項目的設定

### 17. project-list-optimized.html - 優化版項目列表
**功能**: 性能優化後的項目列表頁面

### 18. setup-admin.html - 系統初始化
**功能**: 系統首次設置和管理員帳號創建

### 19. cleanup-storage.html - 存儲清理工具
**功能**: 清理系統緩存和無效數據

---

## 🧪 測試與工具頁面

### 20. test-team-management.html - 工班管理測試
**功能**: 測試工班功能的開發頁面

### 21. test-permissions.html - 權限測試
**功能**: 測試不同用戶角色的權限設定

### 22. unified-api-test.html - API 測試工具
**功能**: 測試後端 API 端點的工具頁面

---

## 🏗️ 頁面架構設計模式

### 1. 組件化架構
```javascript
// 共用組件
├── js/user-profile-component.js  // 用戶資料組件
│   ├── 用戶資料載入
│   ├── 登入狀態管理
│   ├── 權限檢查
│   └── 用戶界面渲染
├── js/common.js                   // 公用函數庫
│   ├── API 調用封裝
│   ├── 日期格式化
│   ├── 權限驗證
│   └── 錯誤處理
└── config.js                      // 環境配置
    ├── API 端點配置
    ├── 環境自動檢測
    └── 常量定義
```

### 2. 響應式設計模式
```css
/* 所有頁面遵循響應式設計 */
@media (max-width: 768px) {
    .desktop-panel { display: none; }
    .mobile-panel { display: block; }
}

/* 使用 Tailwind CSS 的響應式類 */
<div class="hidden md:block">桌面版內容</div>
<div class="block md:hidden">手機版內容</div>
```

### 3. 權限控制模式
```javascript
// 頁面級權限控制
async function init() {
    // 1. 檢查登入狀態
    if (!localStorage.getItem('token')) {
        redirectToLogin();
        return;
    }
    
    // 2. 載入用戶角色
    const userRole = await getCurrentUserProjectRole(projectId);
    
    // 3. 應用權限控制
    applyRoleBasedView(userRole);
    
    // 4. 載入頁面數據
    await loadPageData();
}
```

### 4. 數據載入模式
```javascript
// 統一的數據載入策略
class DataLoader {
    async loadWithCache(key, apiCall, ttl = 3600000) {
        // 1. 檢查 localStorage 緩存
        const cached = this.getFromCache(key);
        if (cached) return cached;
        
        // 2. 調用 API
        const data = await apiCall();
        
        // 3. 存入緩存
        this.saveToCache(key, data, ttl);
        
        return data;
    }
}
```

---

## 🔄 頁面間導航流程

### 用戶使用流程圖
```
登入頁面 (login-simple.html)
    ↓ 驗證成功
項目列表頁 (project-list.html)
    ↓ 選擇項目
項目詳情頁 (project-detail.html)
    ├─→ 用戶管理 (project-user-management.html)
    ├─→ 個人資料 (user-profile.html)  
    └─→ 日誌分享 (daily-log-share.html)

管理員額外流程:
├─→ 全域用戶管理 (global-user-management.html)
├─→ 項目創建 (project-create.html)
└─→ 系統工具頁面
```

### URL 參數傳遞模式
```javascript
// 標準 URL 參數格式
project-detail.html?id=proj_1755555899996
project-user-management.html?project_id=proj_1755555899996
daily-log-share.html?project_id=proj_1755555899996&date=2024-01-01

// JavaScript 參數解析
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('project_id');
```

---

## 📊 頁面複雜度分析

### 高複雜度頁面 (需要重點維護)
1. **project-create.html** ⭐⭐⭐⭐⭐
   - 四步驟創建流程
   - 多 API 數據源整合 (CRM、工程類型、統計、權限)
   - 複雜的表單驗證機制
   - Supabase 認證系統整合
   - 編輯/創建雙模式支持

2. **project-user-management.html** ⭐⭐⭐⭐⭐
   - 複雜的權限邏輯
   - 三數據源整合 (員工、師父、業主)
   - 動態 UI 更新
   - 角色權限控制

3. **project-detail.html** ⭐⭐⭐⭐
   - 多功能整合
   - 實時數據更新
   - 角色相關顯示

4. **project-list.html** ⭐⭐⭐
   - 數據篩選和排序
   - 批量操作
   - 性能優化需求

### 中等複雜度頁面
- global-user-management.html
- member-management.html
- project-create.html

### 低複雜度頁面
- login-simple.html
- user-profile.html
- daily-log-share.html

---

## 🚀 性能優化建議

### 1. 頁面載入優化
```javascript
// 延遲載入非關鍵內容
window.addEventListener('load', () => {
    setTimeout(loadSecondaryContent, 100);
});

// 圖片懶載入
<img loading="lazy" src="image.jpg" alt="description">
```

### 2. 緩存策略
```javascript
// 分層緩存策略
├── 用戶資料: 30分鐘 TTL
├── 項目列表: 10分鐘 TTL  
├── 工班數據: 5分鐘 TTL
└── 即時數據: 不緩存
```

### 3. API 調用優化
```javascript
// 批量請求減少 API 調用
const batchRequests = async (requests) => {
    return Promise.all(requests.map(req => fetchWithRetry(req)));
};
```

---

這個頁面架構文檔詳細說明了系統中每個頁面的功能、用途和技術實現，應該能幫助新工程師快速理解整個系統的結構和各頁面間的關係！