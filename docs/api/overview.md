# API 接口總覽

## 🌐 API 基本資訊

**Base URL**: `https://api.yes-ceramics.com`  
**版本**: v1  
**格式**: JSON  
**認證**: 手機號碼 + 後三碼密碼

## 📋 API 端點列表

### 🔐 認證相關
```http
POST /api/v1/auth/login
```
- 使用者登入
- 參數: `{ phone: "0912345678", passwordSuffix: "678" }`
- 返回: 使用者資訊 + session token + 專案列表

### 📊 專案管理
```http
# 建立專案
POST /api/v1/projects

# 查詢專案
GET /api/v1/projects/{projectId}

# 更新專案
PUT /api/v1/projects/{projectId}

# 刪除專案
DELETE /api/v1/projects/{projectId}
```

### 👥 權限檢查
```http
GET /api/v1/permissions/{projectId}/{userId}
```
- 檢查使用者在專案中的權限
- 返回: 權限資訊 + 角色 + 工班資訊

### 🔄 CRM 同步
```http
# 同步工班資料
POST /api/v1/sync/teams

# 同步業主資料  
POST /api/v1/sync/owners
```

### 🏥 系統健康
```http
# 健康檢查
GET /health

# 建立示範資料
GET /create-demo
```

## 📝 API 設計原則

### 1. RESTful 設計
- 使用標準 HTTP 方法 (GET, POST, PUT, DELETE)
- 資源導向的 URL 結構
- 統一的錯誤回應格式

### 2. 統一回應格式
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2025-08-11T14:00:00.000Z"
}
```

### 3. 錯誤處理
```json
{
  "success": false,
  "error": "PERMISSION_DENIED",
  "message": "您沒有權限執行此操作",
  "code": 403,
  "timestamp": "2025-08-11T14:00:00.000Z"
}
```

## 🔒 認證與授權

### 認證流程
1. **登入**: POST `/api/v1/auth/login`
2. **取得 Token**: 回應包含 `sessionToken`
3. **後續請求**: Header 加入 `Authorization: Bearer {sessionToken}`

### 權限層級
- **管理員** (admin): 所有權限
- **工班領隊** (leader): 管理工班成員和進度
- **工班成員** (member): 更新自己負責的案場
- **業主** (viewer): 查看專案進度

## 📊 專案 API 詳解

### 建立專案
```http
POST /api/v1/projects
Content-Type: application/json

{
  "name": "興安西",
  "opportunityId": "650fe201d184e50001102aee",
  "spcEngineering": {
    "enabled": true,
    "types": ["SPC地板", "塑膠地板", "SPC牆板"],
    "sites": []
  },
  "cabinetEngineering": {
    "enabled": true,
    "types": ["浴櫃"],
    "sites": []
  },
  "teams": [
    {
      "id": "team_1",
      "name": "陳師傅團隊",
      "leaderUserId": "user_001",
      "leaderName": "陳建國",
      "leaderPhone": "0912345678",
      "members": [...]
    }
  ],
  "owners": [
    {
      "id": "owner_1",
      "name": "張美玲",
      "phone": "0945678901"
    }
  ],
  "permissions": {
    "crossViewEnabled": false,
    "fieldPermissions": {
      "ownerPhone": { "view": true, "edit": false },
      "constructionDate": { "view": true, "edit": true }
    }
  },
  "createdBy": "admin"
}
```

### 回應格式
```json
{
  "success": true,
  "projectId": "proj_1723389600_abc123def",
  "message": "專案建立成功"
}
```

## 🔄 同步 API 設計

### 工班同步
```http
POST /api/v1/sync/teams
Content-Type: application/json

{
  "projectId": "proj_123",
  "sites": [
    {
      "id": "site_001",
      "teamId": "team_1",
      "teamName": "陳師傅團隊",
      "status": "active"
    }
  ]
}
```

### 業主同步
```http
POST /api/v1/sync/owners
Content-Type: application/json

{
  "projectId": "proj_123",
  "owners": [
    {
      "id": "contact_001",
      "name": "張美玲",
      "phone": "0945678901",
      "source": "crm"
    }
  ]
}
```

## 🛠️ 開發工具

### API 測試
```bash
# 健康檢查
curl -s "https://api.yes-ceramics.com/health"

# 查詢專案
curl -s "https://api.yes-ceramics.com/api/v1/projects/650fe201d184e50001102aee"

# 建立示範資料
curl -s "https://api.yes-ceramics.com/create-demo"
```

### 本地開發
```bash
# 本地啟動 Worker
wrangler dev --port 8787

# 測試本地 API
curl "http://localhost:8787/health"
```

## 📈 效能考量

### 快取策略
- **靜態資料**: 使用 Cloudflare KV 快取
- **專案列表**: 快取 5 分鐘
- **使用者資訊**: 快取 1 小時

### 限流設計
- **一般 API**: 100 requests/分鐘/IP
- **登入 API**: 10 requests/分鐘/IP
- **同步 API**: 20 requests/分鐘/IP

## 🔍 監控與日誌

### Worker 綁定資源
```javascript
// 環境綁定
env.DB_ENGINEERING  // D1 工程資料庫
env.DB_CRM         // D1 CRM 資料庫
env.SESSIONS       // KV 會話儲存
env.USERS          // KV 使用者快取
env.CONSTRUCTION_PHOTOS // R2 檔案儲存
```

### 日誌記錄
- **所有 API 請求**: 自動記錄到 project_activity_logs
- **錯誤追蹤**: 包含 stack trace 和 request context
- **效能監控**: 記錄回應時間和資料庫查詢數

---

**API 實作檔案**: `workers/src/index.js`  
**最後更新**: 2025-08-11  
**線上服務**: https://api.yes-ceramics.com