# 環境配置使用指南 v3.0.0

## 概述

本項目已完成環境配置重構，實現了以下改進：
- ✅ 集中化配置管理
- ✅ 環境分層（開發/正式）
- ✅ 消除硬編碼 URL
- ✅ 規範化變數命名

## 文件結構

```
工程管理/
├── .env.dev                    # 開發環境變數
├── .env.prod                   # 正式環境變數
├── config/
│   └── api-endpoints.js        # 統一 API 配置
└── frontend/
    └── config.js              # 前端配置入口
```

## 環境配置

### 開發環境 (.env.dev)
```bash
# 主要 API 端點
UNIFIED_API_BASE_URL_DEV=https://construction-management-unified.lai-jameslai.workers.dev
CRM_API_BASE_URL_DEV=https://fx-d1-rest-api.lai-jameslai.workers.dev
FRONTEND_BASE_URL_DEV=https://construction-management-frontend-dev.pages.dev

# Cloudflare 認證
CLOUDFLARE_API_TOKEN_DEV=gF1zTU1MSg5JVfkuXOcVbR44MrC3Hx563iMTygW8
```

### 正式環境 (.env.prod)
```bash
# 主要 API 端點
UNIFIED_API_BASE_URL_PROD=https://construction-management-unified.lai-jameslai.workers.dev
CRM_API_BASE_URL_PROD=https://fx-d1-rest-api.lai-jameslai.workers.dev
FRONTEND_BASE_URL_PROD=https://construction-management-frontend-prod.pages.dev

# Cloudflare 認證
CLOUDFLARE_API_TOKEN_PROD=X5FRsrJA08Ib2c9633HN6He6WEClg9ml_KxTdzGh
```

## 使用方式

### 1. 前端配置

在 HTML 文件中，首先載入配置：
```html
<script src="config.js"></script>
```

然後使用統一的配置變數：
```javascript
// ✅ 正確方式：使用統一配置
const API_URL = CONFIG?.API?.WORKER_API_URL;

// ❌ 錯誤方式：硬編碼 URL
const API_URL = 'https://construction-management-api.lai-jameslai.workers.dev';
```

### 2. API 呼叫範例

```javascript
// 專案創建
const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/projects`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(projectData)
});

// CRM 數據獲取
const crmResponse = await fetch(`${CONFIG.API.CRM_API_URL}/rest/opportunities`, {
    headers: {
        'Authorization': `Bearer ${crmToken}`
    }
});
```

### 3. 環境切換

配置會根據 hostname 自動切換：
- `localhost` → development 環境
- `*-dev.pages.dev` → development 環境  
- `*-prod.pages.dev` → production 環境

## 部署步驟

### 開發環境部署
```bash
# 使用開發環境 token
export CLOUDFLARE_API_TOKEN="gF1zTU1MSg5JVfkuXOcVbR44MrC3Hx563iMTygW8"

# 部署統一 API
cd workers-unified
npx wrangler deploy src/index.js

# 部署前端
cd ../frontend  
npx wrangler pages deploy . --project-name construction-management-frontend-dev
```

### 正式環境部署
```bash
# 使用正式環境 token
export CLOUDFLARE_API_TOKEN="X5FRsrJA08Ib2c9633HN6He6WEClg9ml_KxTdzGh"

# 部署統一 API (同一個 Worker)
cd workers-unified
npx wrangler deploy src/index.js

# 部署前端
cd ../frontend
npx wrangler pages deploy . --project-name construction-management-frontend-prod
```

## API 端點總覽

### 統一 API Gateway
- **開發**: https://construction-management-unified.lai-jameslai.workers.dev
- **正式**: https://construction-management-unified.lai-jameslai.workers.dev (同一個)

### 可用端點
- `GET /health` - 健康檢查
- `POST /api/v1/auth/login` - 用戶登入
- `GET /api/v1/projects` - 取得專案列表
- `POST /api/v1/projects` - 創建專案
- `GET /test-db` - 資料庫測試 (除錯用)

### CRM API
- **開發**: https://fx-d1-rest-api.lai-jameslai.workers.dev
- **正式**: https://fx-d1-rest-api.lai-jameslai.workers.dev

## 故障排除

### 1. API 配置錯誤
如果看到 `ERROR_NO_CONFIG` 錯誤，檢查：
1. `config.js` 是否正確載入
2. `CONFIG` 全域變數是否可用
3. API URL 配置是否正確

### 2. 環境切換問題
檢查 `console.log` 輸出：
```javascript
console.log('Environment:', CONFIG.ENVIRONMENT);
console.log('API URL:', CONFIG.API.WORKER_API_URL);
```

### 3. CORS 問題
如果遇到 CORS 錯誤，檢查 Workers 的 CORS 設定。

## 變更日誌

### v3.0.0 (2025-08-21)
- ✅ 建立環境分層配置 (.env.dev, .env.prod) 
- ✅ 實現統一 API 配置管理
- ✅ 消除所有硬編碼 URLs
- ✅ 修復專案創建功能
- ✅ 規範化變數命名 (加環境字尾)
- ✅ 建立使用指南和文檔

## 聯絡資訊

如有問題，請參考：
- 部署日誌：`/workers-unified/wrangler.toml`
- 前端配置：`/frontend/config.js`
- API 文檔：查看各端點的 JSDoc 註釋