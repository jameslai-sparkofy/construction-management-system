# 工程管理系統 - 完整技術文檔

## 📋 目錄
- [項目概述](#項目概述)
- [技術架構](#技術架構)
- [系統角色與權限](#系統角色與權限)
- [API 架構](#api-架構)
- [前端架構](#前端架構)
- [數據庫設計](#數據庫設計)
- [外部系統集成](#外部系統集成)
- [開發環境設置](#開發環境設置)
- [部署流程](#部署流程)
- [故障排除](#故障排除)

---

## 🏗️ 項目概述

### 系統目的
工程管理系統是一個全面的建築工地管理平台，用於：
- 管理建築項目和工地
- 協調不同工班的工作安排
- 追蹤工程進度和人員配置
- 整合 CRM 系統數據

### 核心功能
- **用戶管理**：多角色用戶系統（管理員、業主、工班負責人、工班成員）
- **項目管理**：建築項目的創建、編輯、追蹤
- **工班管理**：工班組織、成員分配、權限控制
- **進度管理**：工程進度追蹤、日誌記錄
- **數據同步**：與 FX CRM 系統的雙向數據同步

---

## 🏛️ 技術架構

### 整體架構圖
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│                 │    │                  │    │                 │
│ Cloudflare      │◄──►│ Cloudflare       │◄──►│ Cloudflare D1   │
│ Pages           │    │ Workers          │    │ (SQLite)        │
│                 │    │                  │    │                 │
│ HTML/CSS/JS     │    │ REST API         │    │ Multiple DBs    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   External CRM   │
                        │                  │
                        │   FX CRM API     │
                        │   Salesforce     │
                        └──────────────────┘
```

### 技術棧

**前端技術**
- **框架**：原生 HTML/CSS/JavaScript（無框架）
- **樣式**：Tailwind CSS（CDN）
- **部署**：Cloudflare Pages
- **打包**：無需打包，直接靜態文件

**後端技術**
- **運行時**：Cloudflare Workers
- **語言**：JavaScript (ES2022)
- **API 風格**：RESTful
- **認證**：基於 Token 的無狀態認證

**數據庫**
- **主數據庫**：Cloudflare D1 (SQLite)
- **緩存**：Cloudflare KV Store
- **文件存儲**：Cloudflare R2

**外部集成**
- **CRM 系統**：FX CRM (Salesforce)
- **通知服務**：Email/SMS 集成

---

## 👥 系統角色與權限

### 用戶角色層級

```
管理員 (admin)
├─ 完整系統權限
├─ 查看所有項目和用戶
├─ 管理系統配置
└─ 數據同步控制

業主 (owner)
├─ 查看自己的項目
├─ 審核工程進度
├─ 無編輯權限
└─ 接收進度報告

工班負責人 (team leader)
├─ 管理自己工班成員
├─ 編輯工班項目數據
├─ 創建/編輯師父資料
├─ 查看工班進度
└─ 提交工作日誌

工班成員 (team member)
├─ 查看指派任務
├─ 更新工作狀態
├─ 提交工作記錄
└─ 查看工班信息
```

### 權限控制實現

**前端權限控制**
```javascript
// 用戶角色檢查
function checkUserPermission(requiredRole) {
    const userRole = getCurrentUserRole();
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// UI 元素權限控制
function applyRoleBasedView() {
    if (currentUserProjectRole.user_type === 'worker' && 
        currentUserProjectRole.role === 'leader') {
        // 工班負責人：限制可見功能
        hideAdminTabs();
        filterTeamData();
    }
}
```

**後端權限驗證**
```javascript
// API 端點權限中間件
async function validatePermissions(request, requiredPermission) {
    const token = request.headers.get('Authorization');
    const user = await validateToken(token);
    
    if (!hasPermission(user, requiredPermission)) {
        return new Response('Forbidden', { status: 403 });
    }
}
```

---

## 🔌 API 架構

### API 基礎信息

**基礎 URL**
- 開發環境: `https://construction-management-api-dev.lai-jameslai.workers.dev`
- 生產環境: `https://construction-management-api-prod.lai-jameslai.workers.dev`

**認證方式**
```http
Authorization: Bearer <JWT_TOKEN>
```

**響應格式**
```json
{
    "success": true,
    "data": {},
    "error": null,
    "timestamp": "2024-01-01T00:00:00Z"
}
```

### 核心 API 端點

#### 用戶管理 API

**獲取可用用戶列表**
```http
GET /api/v1/users/available/{source}
```
- `source`: `admins` | `workers` | `owners`
- 返回：用戶列表及詳細信息

**添加用戶到項目**
```http
POST /api/v1/projects/{projectId}/users/add
Content-Type: application/json

{
    "user_id": "string",
    "user_type": "worker",
    "role": "leader",
    "team_id": "string"
}
```

**更新用戶角色**
```http
PUT /api/v1/projects/{projectId}/users/{userId}/role
Content-Type: application/json

{
    "role": "leader" | "member"
}
```

**移除項目用戶**
```http
DELETE /api/v1/projects/{projectId}/users/{userId}
```

#### 項目管理 API

**獲取項目列表**
```http
GET /api/v1/projects
Query Parameters:
- user_id: string (可選)
- status: active | completed | archived (可選)
```

**獲取項目詳情**
```http
GET /api/v1/projects/{projectId}
```

**創建項目**
```http
POST /api/v1/projects
Content-Type: application/json

{
    "name": "string",
    "description": "string",
    "opportunity_id": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
}
```

#### 工班管理 API

**獲取工班列表**
```http
GET /api/v1/teams
Query Parameters:
- project_id: string (可選)
```

**獲取工班成員**
```http
GET /api/v1/teams/{teamId}/workers
```

**創建工班師父**
```http
POST /api/v1/teams/{teamId}/workers
Content-Type: application/json

{
    "name": "string",
    "phone": "string",
    "nickname": "string",
    "password": "string",
    "email": "string"
}
```

#### CRM 同步 API

**同步用戶數據**
```http
POST /api/v1/sync/users
Content-Type: application/json

{
    "source": "crm",
    "force": false
}
```

**同步項目數據**
```http
POST /api/v1/sync/projects
```

---

## 🎨 前端架構

### 文件結構
```
frontend/
├── config.js                 # 環境配置
├── js/
│   ├── user-profile-component.js  # 用戶組件
│   └── common.js             # 公共函數
├── project-list.html         # 項目列表頁
├── project-detail.html       # 項目詳情頁
├── project-user-management.html  # 用戶管理頁
├── login.html                # 登入頁面
└── daily-log-share.html      # 日誌分享頁
```

### 核心設計模式

**配置管理**
```javascript
// config.js - 環境自動檢測
const CONFIG = {
    development: {
        API_BASE: 'https://construction-management-api-dev.lai-jameslai.workers.dev'
    },
    production: {
        API_BASE: 'https://construction-management-api-prod.lai-jameslai.workers.dev'
    }
};

// 自動環境檢測
const ENV = window.location.hostname.includes('dev') ? 'development' : 'production';
const API_BASE = CONFIG[ENV].API_BASE;
```

**用戶狀態管理**
```javascript
// 用戶認證狀態
class UserManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    }

    async getCurrentUserProjectRole(projectId) {
        const response = await fetch(`${API_BASE}/api/v1/users/me/projects/${projectId}/role`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return response.json();
    }
}
```

**數據緩存策略**
```javascript
// localStorage 緩存
const CacheManager = {
    set(key, data, ttl = 3600000) { // 1小時
        const item = {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        };
        localStorage.setItem(key, JSON.stringify(item));
    },

    get(key) {
        const item = JSON.parse(localStorage.getItem(key));
        if (!item) return null;
        
        if (Date.now() - item.timestamp > item.ttl) {
            localStorage.removeItem(key);
            return null;
        }
        return item.data;
    }
};
```

---

## 🗄️ 數據庫設計

### D1 數據庫結構

**主要數據表**

```sql
-- 用戶表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 項目表
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    opportunity_id TEXT,
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 項目用戶關聯表
CREATE TABLE project_users (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL, -- admin, owner, worker
    role TEXT, -- leader, member (for workers)
    team_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 工班表
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 工作日誌表
CREATE TABLE daily_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT,
    date DATE DEFAULT CURRENT_DATE,
    images TEXT, -- JSON array of image URLs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**數據庫配置**
```toml
# wrangler.toml
[[d1_databases]]
name = "engineering-management"
database_name = "engineering-management"
database_id = "your-database-id"
```

### FX CRM 集成表

```sql
-- CRM 同步映射表
CREATE TABLE crm_mappings (
    local_id TEXT NOT NULL,
    crm_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- user, project, team
    last_synced DATETIME,
    PRIMARY KEY (local_id, entity_type)
);

-- 從 FX CRM 同步的員工數據
CREATE TABLE employees_simple (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    email TEXT,
    department TEXT,
    crm_source_id TEXT
);
```

---

## 🔗 外部系統集成

### FX CRM 集成

**API 連接配置**
```javascript
// CRM API 配置
const CRM_CONFIG = {
    baseUrl: 'https://api.fxcrm.com/v1',
    apiKey: env.FX_CRM_API_KEY,
    endpoints: {
        users: '/users',
        opportunities: '/opportunities',
        contacts: '/contacts'
    }
};

// CRM 數據同步
async function syncFromCRM(entityType) {
    const response = await fetch(`${CRM_CONFIG.baseUrl}${CRM_CONFIG.endpoints[entityType]}`, {
        headers: {
            'Authorization': `Bearer ${CRM_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    
    const crmData = await response.json();
    return await upsertToLocalDB(crmData, entityType);
}
```

**數據映射策略**
```javascript
// CRM 到本地數據映射
const CRM_MAPPING = {
    user: {
        'Name': 'name',
        'Phone': 'phone', 
        'Email': 'email',
        'Id': 'crm_source_id'
    },
    opportunity: {
        'Name': 'project_name',
        'Description': 'description',
        'Id': 'opportunity_id'
    }
};
```

### Cloudflare 服務集成

**KV Store 使用**
```javascript
// 會話管理
await env.KV_SESSIONS.put(`session:${userId}`, JSON.stringify(sessionData), {
    expirationTtl: 86400 // 24小時
});

// 緩存頻繁查詢
const cacheKey = `teams:${projectId}`;
let teams = await env.KV_CACHE.get(cacheKey, 'json');
if (!teams) {
    teams = await getTeamsFromDB(projectId);
    await env.KV_CACHE.put(cacheKey, JSON.stringify(teams), {
        expirationTtl: 3600 // 1小時
    });
}
```

**R2 存儲使用**
```javascript
// 文件上傳
async function uploadImage(file, key) {
    await env.R2_BUCKET.put(key, file.stream(), {
        httpMetadata: {
            contentType: file.type
        }
    });
    return `https://r2.domain.com/${key}`;
}
```

---

## 💻 開發環境設置

### 必要工具安裝

```bash
# 安裝 Node.js (v20+)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# 安裝 Wrangler CLI
npm install -g wrangler

# 登入 Cloudflare
wrangler login
```

### 項目設置

```bash
# 克隆項目
git clone <repository-url>
cd construction-management-system

# 安裝依賴
npm install

# 配置環境變數
cp .env.example .env
# 編輯 .env 文件，添加必要的 API 密鑰
```

### 本地開發

**啟動後端開發服務器**
```bash
cd workers
wrangler dev --local
# 服務將在 http://localhost:8787 運行
```

**啟動前端開發服務器**
```bash
cd frontend
# 使用簡單 HTTP 服務器
python -m http.server 3000
# 或使用 live-server
npx live-server --port=3000
```

**數據庫操作**
```bash
# 創建本地數據庫
wrangler d1 create engineering-management-local

# 執行 schema
wrangler d1 execute engineering-management-local --file=schema.sql

# 查詢數據庫
wrangler d1 execute engineering-management-local --command="SELECT * FROM users"
```

---

## 🚀 部署流程

### GitHub Actions 自動部署

**工作流程檔案結構**
```
.github/workflows/
├── deploy-api-dev.yml          # API 開發環境
├── deploy-api-prod.yml         # API 生產環境
├── deploy-frontend-dev.yml     # 前端開發環境
├── deploy-frontend-prod.yml    # 前端生產環境
└── deploy-frontend-new-main.yml # 新主分支部署
```

**部署觸發條件**
- **開發環境**：推送到 `develop` 分支時自動觸發
- **生產環境**：推送到 `main` 分支或手動觸發（需要確認碼）

**部署流程範例**
```yaml
name: Deploy API to Development
on:
  push:
    branches: [develop]
    paths: ['workers/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Deploy to Cloudflare Workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          cd workers
          npx wrangler deploy --config wrangler.dev.toml
```

### 手動部署

**API 部署**
```bash
# 開發環境
cd workers
npx wrangler deploy --config wrangler.dev.toml

# 生產環境  
npx wrangler deploy --config wrangler.prod.toml
```

**前端部署**
```bash
# 開發環境
npx wrangler pages deploy frontend --project-name construction-management-frontend-dev

# 生產環境
npx wrangler pages deploy frontend --project-name construction-management-frontend-prod
```

### 環境配置

**開發環境 URLs**
- API: `https://construction-management-api-dev.lai-jameslai.workers.dev`
- 前端: `https://construction-management-frontend-dev.pages.dev`

**生產環境 URLs**  
- API: `https://construction-management-api-prod.lai-jameslai.workers.dev`
- 前端: `https://construction-management-frontend-prod.pages.dev`

---

## 🔧 故障排除

### 常見問題解決

**1. GitHub Actions 部署失敗**

```bash
# 檢查 API Token 權限
npx wrangler whoami

# 檢查配置文件語法
npx wrangler deploy --dry-run
```

**解決方案：**
- 確認 `CLOUDFLARE_API_TOKEN` Secret 設置正確
- 檢查 Node.js 版本 (需要 v20+)
- 驗證 wrangler.toml 配置語法

**2. 中文 Commit Message 部署錯誤**

```
錯誤: Invalid commit message, it must be a valid UTF-8 string
```

**解決方案：**
```bash
# 修改為英文 commit message
git commit --amend -m "Fix user permission display issue"
git push --force
```

**3. 用戶權限顯示問題**

**症狀：** 工班負責人看到管理員數據
**排查步驟：**
```javascript
// 檢查用戶角色
console.log('Current user role:', currentUserProjectRole);

// 檢查權限控制函數
console.log('applyRoleBasedView called:', !!document.querySelector('.role-applied'));

// 檢查 API 響應
console.log('API response:', availableUsersList);
```

**4. 數據庫連接問題**

```bash
# 檢查 D1 數據庫連接
wrangler d1 execute engineering-management --command="SELECT 1"

# 檢查數據表結構
wrangler d1 execute engineering-management --command=".schema"
```

**5. CRM 同步失敗**

**檢查步驟：**
```javascript
// 檢查 API 密鑰
console.log('CRM API Key configured:', !!env.FX_CRM_API_KEY);

// 測試 CRM 連接
const testResponse = await fetch(CRM_CONFIG.baseUrl + '/health');
console.log('CRM Health Status:', testResponse.status);
```

### 調試工具

**前端調試**
```javascript
// 啟用詳細日誌
localStorage.setItem('DEBUG_MODE', 'true');

// 查看用戶狀態
console.log('User Info:', localStorage.getItem('userInfo'));

// 檢查 API 配置
console.log('Current API Base:', API_BASE);
```

**後端調試**
```bash
# 查看 Worker 日誌
wrangler tail construction-management-api-dev

# 檢查環境變數
wrangler secret list
```

**數據庫調試**
```sql
-- 檢查用戶項目關聯
SELECT pu.*, u.name, p.name as project_name 
FROM project_users pu 
JOIN users u ON pu.user_id = u.id 
JOIN projects p ON pu.project_id = p.id 
WHERE pu.project_id = 'proj_1755555899996';

-- 檢查工班數據
SELECT * FROM teams WHERE project_id = 'proj_1755555899996';
```

---

## 📚 開發指南

### 代碼規範

**命名約定**
- 變數：camelCase (`currentUser`, `projectList`)
- 常數：UPPER_CASE (`API_BASE`, `USER_ROLES`)
- 函數：camelCase (`getUserRole`, `validatePermission`)
- CSS 類：kebab-case (`user-item`, `project-card`)

**API 設計原則**
- 使用 RESTful URL 結構
- 一致的響應格式
- 適當的 HTTP 狀態碼
- 詳細的錯誤信息

**安全實踐**
- 輸入驗證和清理
- SQL 注入防護
- XSS 攻擊防護
- 敏感信息加密存儲

### 性能優化

**前端優化**
- 使用 localStorage 緩存頻繁查詢數據
- 圖片懶加載
- 避免不必要的 API 請求

**後端優化**
- KV Store 緩存熱點數據
- 數據庫查詢優化
- 批量操作減少請求次數

---

## 🤝 貢獻指南

### 開發流程

1. **創建功能分支**
```bash
git checkout -b feature/new-feature-name
```

2. **開發和測試**
```bash
# 本地測試
npm run test
npm run lint

# 手動測試核心功能
```

3. **提交變更**
```bash
git add .
git commit -m "feat: add new feature description"
git push origin feature/new-feature-name
```

4. **創建 Pull Request**
- 詳細描述變更內容
- 添加測試截圖
- 標記相關的 Issue

### 測試策略

**手動測試清單**
- [ ] 用戶登入/登出功能
- [ ] 不同角色權限驗證
- [ ] 項目創建和編輯
- [ ] 工班成員管理
- [ ] CRM 數據同步
- [ ] 移動設備響應式設計

---

## 📞 支援與聯繫

### 開發團隊
- **項目負責人**: [聯繫信息]
- **後端開發**: [聯繫信息]  
- **前端開發**: [聯繫信息]

### 資源連結
- **GitHub Repository**: [項目地址]
- **Cloudflare Dashboard**: [控制台地址]
- **CRM 系統文檔**: [FX CRM API 文檔]
- **設計稿**: [Figma/設計文檔地址]

---

*本文檔最後更新：2024年1月*
*文檔版本：v1.0*

---

> 💡 **提示**: 建議新工程師先閱讀「項目概述」和「技術架構」部分，然後根據負責的領域深入閱讀相關章節。如有疑問，歡迎聯繫開發團隊。