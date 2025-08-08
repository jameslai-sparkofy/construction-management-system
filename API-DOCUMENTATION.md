# API 文檔 - 工程管理系統

## Base URL
- Development: `http://localhost:8787`
- Production: `https://construction-management-api.workers.dev`

## 認證方式

所有 API 請求需要在 Header 中包含 JWT Token：
```
Authorization: Bearer <token>
```

獲取 Token：通過登入 API 獲取

## API 端點

### 1. 認證 APIs

#### 1.1 登入
```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "phone": "0912345678",
  "password": "678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-123",
      "name": "王大明",
      "phone": "0912345678",
      "role": "admin"
    }
  }
}
```

#### 1.2 登出
```http
POST /api/v1/auth/logout
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "登出成功"
}
```

#### 1.3 獲取當前用戶
```http
GET /api/v1/auth/me
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "name": "王大明",
    "phone": "0912345678",
    "role": "admin",
    "email": "wang@example.com"
  }
}
```

### 2. 專案管理 APIs

#### 2.1 獲取專案列表
```http
GET /api/v1/projects
```

**Query Parameters:**
- `page` (optional): 頁碼，預設 1
- `limit` (optional): 每頁筆數，預設 20
- `status` (optional): 專案狀態 (active/completed/archived)
- `search` (optional): 搜尋關鍵字

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj-001",
        "name": "台北建案A",
        "opportunity_id": "opp-123",
        "status": "active",
        "spc_engineering": {
          "enabled": true,
          "site_count": 120,
          "completed_count": 45
        },
        "cabinet_engineering": {
          "enabled": true,
          "site_count": 80,
          "completed_count": 30
        },
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

#### 2.2 創建專案
```http
POST /api/v1/projects
```

**Request Body:**
```json
{
  "opportunity_id": "opp-123",
  "name": "台北建案B",
  "spc_engineering": {
    "enabled": true,
    "sites": ["site1", "site2"]
  },
  "cabinet_engineering": {
    "enabled": false
  },
  "permissions": {
    "leaders": ["user-001", "user-002"],
    "members": ["user-003", "user-004"],
    "owners": ["user-005"],
    "canCrossView": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj-002",
    "message": "專案創建成功"
  }
}
```

#### 2.3 獲取專案詳情
```http
GET /api/v1/projects/:projectId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj-001",
    "name": "台北建案A",
    "opportunity_id": "opp-123",
    "status": "active",
    "spc_engineering": {
      "enabled": true,
      "settings": {},
      "statistics": {
        "total_sites": 120,
        "completed": 45,
        "in_progress": 30,
        "pending": 45
      }
    },
    "cabinet_engineering": {
      "enabled": true,
      "settings": {},
      "statistics": {
        "total_sites": 80,
        "completed": 30,
        "in_progress": 20,
        "pending": 30
      }
    },
    "permissions": {
      "leaders": ["user-001"],
      "members": ["user-002", "user-003"],
      "owners": ["user-004"]
    },
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-08T00:00:00Z"
  }
}
```

#### 2.4 更新專案
```http
PUT /api/v1/projects/:projectId
```

**Request Body:**
```json
{
  "name": "台北建案A (更新)",
  "status": "active",
  "permissions": {
    "leaders": ["user-001", "user-006"],
    "members": ["user-002", "user-003"],
    "owners": ["user-004"]
  }
}
```

#### 2.5 刪除專案
```http
DELETE /api/v1/projects/:projectId
```

### 3. 案場管理 APIs

#### 3.1 獲取案場列表
```http
GET /api/v1/projects/:projectId/sites
```

**Query Parameters:**
- `type`: 案場類型 (spc/cabinet)
- `building`: 棟別篩選
- `floor`: 樓層篩選
- `status`: 狀態篩選
- `page`: 頁碼
- `limit`: 每頁筆數

**Response:**
```json
{
  "success": true,
  "data": {
    "sites": [
      {
        "_id": "site-001",
        "name": "A-15-1",
        "field_WD7k1__c": "A",
        "field_Q6Svh__c": 15,
        "field_XuJP2__c": "1",
        "construction_completed__c": true,
        "field_23pFq__c": "2025-01-05",
        "field_u1wpv__c": "王師傅",
        "field_B2gh1__c": 25.5
      }
    ],
    "total": 120,
    "statistics": {
      "total": 120,
      "completed": 45,
      "in_progress": 30,
      "pending": 45
    }
  }
}
```

#### 3.2 更新案場資料
```http
PUT /api/v1/sites/:siteId
```

**Request Body:**
```json
{
  "type": "spc",
  "field_23pFq__c": "2025-01-08",
  "field_B2gh1__c": 28.5,
  "construction_completed__c": true,
  "field_u1wpv__c": "李師傅",
  "field_3Fqof__c": "https://r2.url/photo.jpg"
}
```

### 4. CRM 資料 APIs

#### 4.1 獲取商機列表
```http
GET /api/v1/crm/opportunities
```

**Query Parameters:**
- `search`: 搜尋關鍵字
- `limit`: 筆數限制

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "opp-123",
      "name": "台北建案A",
      "account_id": "acc-456",
      "stage": "進行中",
      "amount": 50000000
    }
  ]
}
```

#### 4.2 獲取CRM案場資料
```http
GET /api/v1/crm/sites
```

**Query Parameters:**
- `opportunity_id`: 商機ID
- `type`: 案場類型 (spc/cabinet)
- `limit`: 筆數限制

### 5. 檔案上傳 APIs

#### 5.1 上傳施工照片
```http
POST /api/v1/upload
```

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `file`: 圖片檔案
  - `project_id`: 專案ID
  - `site_id`: 案場ID
  - `type`: 照片類型 (construction/completion/defect)

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://r2.construction-photos.com/abc123.jpg",
    "key": "projects/proj-001/sites/site-001/abc123.jpg",
    "size": 1024000,
    "type": "image/jpeg"
  }
}
```

#### 5.2 獲取檔案列表
```http
GET /api/v1/files
```

**Query Parameters:**
- `project_id`: 專案ID
- `site_id`: 案場ID
- `type`: 檔案類型

### 6. 權限管理 APIs

#### 6.1 獲取專案權限
```http
GET /api/v1/projects/:projectId/permissions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leaders": [
      {
        "id": "user-001",
        "name": "王大明",
        "phone": "0912345678",
        "engineeringTypes": ["SPC", "CABINET"]
      }
    ],
    "members": [],
    "owners": [],
    "canCrossView": false
  }
}
```

#### 6.2 設定專案權限
```http
POST /api/v1/projects/:projectId/permissions
```

**Request Body:**
```json
{
  "userId": "user-007",
  "role": "member",
  "engineeringType": "SPC",
  "canEdit": true,
  "canViewOthers": false
}
```

### 7. 統計報表 APIs

#### 7.1 獲取專案統計
```http
GET /api/v1/projects/:projectId/statistics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "spc": {
      "total": 120,
      "completed": 45,
      "completion_rate": 37.5,
      "by_building": {
        "A": { "total": 40, "completed": 20 },
        "B": { "total": 40, "completed": 15 },
        "C": { "total": 40, "completed": 10 }
      },
      "by_floor": {
        "1": { "total": 10, "completed": 5 },
        "2": { "total": 10, "completed": 4 }
      }
    },
    "cabinet": {
      "total": 80,
      "completed": 30,
      "completion_rate": 37.5
    }
  }
}
```

## 錯誤代碼

| 代碼 | 說明 |
|------|------|
| 200 | 成功 |
| 400 | 請求參數錯誤 |
| 401 | 未授權 |
| 403 | 權限不足 |
| 404 | 資源不存在 |
| 429 | 請求過於頻繁 |
| 500 | 伺服器錯誤 |

## 錯誤回應格式

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "請先登入",
    "details": {}
  }
}
```

## Rate Limiting

- 預設限制：每分鐘 60 次請求
- 生產環境：每分鐘 100 次請求
- 超過限制返回 429 錯誤

## CORS 設定

預設允許的來源：
- Development: `http://localhost:*`
- Production: 設定的前端網域

## Webhook 支援

系統支援以下事件的 Webhook：
- `project.created` - 專案創建
- `project.updated` - 專案更新
- `site.completed` - 案場完工
- `user.login` - 用戶登入

設定 Webhook：
```http
POST /api/v1/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["project.created", "site.completed"],
  "secret": "your-webhook-secret"
}
```

## SDK 範例

### JavaScript/TypeScript
```javascript
import { ConstructionAPI } from '@construction/sdk';

const api = new ConstructionAPI({
  baseURL: 'https://construction-management-api.workers.dev',
  token: 'your-jwt-token'
});

// 獲取專案列表
const projects = await api.projects.list();

// 更新案場
await api.sites.update('site-001', {
  construction_completed__c: true,
  field_23pFq__c: '2025-01-08'
});
```

### cURL
```bash
# 登入
curl -X POST https://construction-management-api.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0912345678","password":"678"}'

# 獲取專案列表
curl https://construction-management-api.workers.dev/api/v1/projects \
  -H "Authorization: Bearer <token>"
```

## 測試環境

提供 Postman Collection：
- [下載 Postman Collection](./postman-collection.json)
- 環境變數設定：
  - `base_url`: API 基礎網址
  - `token`: JWT Token

## 支援

如需技術支援，請聯繫：
- Email: support@construction-system.com
- Documentation: https://docs.construction-system.com