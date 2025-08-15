# API 介面文件

## API 概述

Construction Management API 是基於 Cloudflare Workers 構建的 RESTful API 服務，提供工程管理系統的所有後端功能。

### 基本資訊

- **基礎 URL**: `https://construction-api-development.lai-jameslai.workers.dev`
- **生產環境**: `https://api.yes-ceramics.com`
- **版本**: v1
- **認證方式**: Bearer Token

### 請求格式

```http
GET /api/v1/resource
Authorization: Bearer {token}
Content-Type: application/json
```

## 認證 API

### 1. 用戶登入

**端點**: `POST /api/v1/login`

**請求體**:
```json
{
  "phone": "0912345678",
  "password": "678"
}
```

**回應**:
```json
{
  "success": true,
  "user": {
    "id": "user_001",
    "name": "張師傅",
    "phone": "0912345678",
    "role": "team_member"
  },
  "token": "token_1234567890_abcdefg"
}
```

### 2. 獲取當前用戶

**端點**: `GET /api/v1/users/me`

**Headers**:
```
Authorization: Bearer {token}
```

**回應**:
```json
{
  "id": "user_001",
  "name": "張師傅",
  "phone": "0912345678",
  "role": "team_member",
  "teams": ["周華龍工班", "李明工班"]
}
```

## 專案 API

### 1. 獲取專案列表

**端點**: `GET /api/v1/projects`

**回應**:
```json
[
  {
    "id": "proj_1755172976943",
    "name": "勝美-育賢二-2023",
    "opportunity_id": "650c09e8dc044f0001973eab",
    "project_code": "PRJ-2025-001",
    "status": "active",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### 2. 獲取專案詳情

**端點**: `GET /api/v1/projects/{projectId}`

**回應**:
```json
{
  "success": true,
  "project": {
    "id": "proj_1755172976943",
    "name": "勝美-育賢二-2023",
    "description": "勝美建設育賢二期工程",
    "sites_count": 427,
    "teams_count": 3,
    "members_count": 15,
    "completion_rate": 0.35
  }
}
```

## 工班 API

### 1. 獲取專案工班列表

**端點**: `GET /api/v1/projects/{projectId}/teams`

**回應**:
```json
{
  "teams": [
    {
      "id": "team_001",
      "name": "周華龍工班",
      "memberCount": 5,
      "leaders": [
        {
          "userId": "user_001",
          "name": "周華龍",
          "phone": "0912345678"
        }
      ],
      "members": [
        {
          "userId": "user_002",
          "name": "張師傅",
          "phone": "0923456789",
          "role": "team_member"
        }
      ]
    }
  ]
}
```

### 2. 新增工班成員

**端點**: `POST /api/v1/projects/{projectId}/teams/{teamId}/members`

**請求體**:
```json
{
  "userId": "user_003",
  "name": "李師傅",
  "phone": "0934567890",
  "role": "team_member",
  "sourceType": "crm_worker",
  "sourceId": "worker_003"
}
```

**回應**:
```json
{
  "success": true,
  "message": "成員已新增",
  "member": {
    "id": "member_001",
    "userId": "user_003",
    "teamId": "team_001",
    "role": "team_member"
  }
}
```

### 3. 更新工班成員

**端點**: `PATCH /api/v1/projects/{projectId}/teams/{teamId}/members/{memberId}`

**請求體**:
```json
{
  "name": "李大師",
  "abbreviation": "李",
  "role": "team_leader"
}
```

**回應**:
```json
{
  "success": true,
  "message": "成員資料已更新"
}
```

### 4. 刪除工班成員

**端點**: `DELETE /api/v1/projects/{projectId}/teams/{teamId}/members/{memberId}`

**回應**:
```json
{
  "success": true,
  "message": "成員已移除"
}
```

### 5. 獲取工班成員列表

**端點**: `GET /api/v1/projects/{projectId}/teams/{teamId}/members`

**回應**:
```json
[
  {
    "userId": "user_001",
    "name": "周華龍",
    "phone": "0912345678",
    "role": "team_leader",
    "abbreviation": "周"
  },
  {
    "userId": "user_002",
    "name": "張師傅",
    "phone": "0923456789",
    "role": "team_member",
    "abbreviation": "張"
  }
]
```

## 案場 API

### 1. 獲取案場列表

**端點**: `GET /api/v1/sites`

**查詢參數**:
- `opportunity_id`: 商機 ID（必填）
- `building`: 棟別篩選
- `floor`: 樓層篩選
- `status`: 狀態篩選

**回應**:
```json
{
  "sites": [
    {
      "_id": "site_001",
      "field_WD7k1__c": "A",           // 棟別
      "field_Q6Svh__c": "15",          // 樓層
      "field_XuJP2__c": "A1",          // 戶別
      "shift_time__c": "team_001",     // 工班 ID
      "team_name": "周華龍工班",        // 工班名稱
      "field_B2gh1__c": "17.30",       // 鋪設坪數
      "construction_completed__c": false // 施工狀態
    }
  ]
}
```

### 2. 更新案場資料

**端點**: `PATCH /api/v1/sites/{siteId}`

**請求體**:
```json
{
  "construction_completed__c": true,
  "field_23pFq__c": "2025-08-15",  // 施工日期
  "field_u1wpv__c": "張師傅"        // 工班師父
}
```

**回應**:
```json
{
  "success": true,
  "message": "案場資料已更新"
}
```

## CRM 同步 API

### 1. 同步工地師父資料

**端點**: `GET /rest/object_50HJ8__c`

**Headers**:
```
Authorization: Bearer fx-crm-api-secret-2025
```

**回應**:
```json
{
  "success": true,
  "results": [
    {
      "_id": "worker_001",
      "name": "張師傅",
      "phone_number__c": "0912345678",
      "account__c": "0912345678",
      "password__c": "678",
      "abbreviation__c": "張",
      "shift_type_multi_select__c": ["周華龍工班", "李明工班"]
    }
  ]
}
```

### 2. 建立新工地師父

**端點**: `POST /rest/object_50HJ8__c`

**請求體**:
```json
{
  "name": "新師傅",
  "phone_number__c": "0945678901",
  "account__c": "0945678901",
  "password__c": "901",
  "abbreviation__c": "新",
  "shift_type_multi_select__c": ["周華龍工班"]
}
```

### 3. 更新工地師父工班

**端點**: `PATCH /rest/object_50HJ8__c/{workerId}`

**請求體**:
```json
{
  "shift_type_multi_select__c": ["周華龍工班", "新工班"]
}
```

## 權限 API

### 1. 獲取用戶權限

**端點**: `GET /api/v1/projects/{projectId}/permissions`

**回應**:
```json
{
  "project_id": "proj_001",
  "user_id": "user_001",
  "permissions": {
    "can_view": true,
    "can_edit": false,
    "can_manage_members": false,
    "can_view_other_teams": false
  },
  "team_permissions": [
    {
      "team_id": "team_001",
      "team_name": "周華龍工班",
      "role": "team_member",
      "can_edit": true,
      "can_manage_members": false
    }
  ]
}
```

### 2. 獲取案場權限

**端點**: `GET /api/v1/sites/{siteId}/permissions`

**回應**:
```json
{
  "site_id": "site_001",
  "team_id": "team_001",
  "can_view": true,
  "can_edit": true,
  "can_manage_members": false,
  "can_view_other_teams": false
}
```

## 錯誤處理

### 錯誤回應格式

```json
{
  "success": false,
  "error": "錯誤訊息",
  "code": "ERROR_CODE",
  "details": {}
}
```

### 常見錯誤碼

| 錯誤碼 | HTTP 狀態碼 | 說明 |
|--------|------------|------|
| `UNAUTHORIZED` | 401 | 未認證或 Token 無效 |
| `FORBIDDEN` | 403 | 無權限執行此操作 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `DUPLICATE_ENTRY` | 409 | 重複的資料 |
| `VALIDATION_ERROR` | 400 | 請求資料驗證失敗 |
| `INTERNAL_ERROR` | 500 | 伺服器內部錯誤 |

### 錯誤處理範例

```javascript
try {
  const response = await fetch(`${API_URL}/api/v1/projects`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    switch (error.code) {
      case 'UNAUTHORIZED':
        // 重新登入
        redirectToLogin();
        break;
      case 'FORBIDDEN':
        alert('您沒有權限執行此操作');
        break;
      default:
        alert(error.error || '發生錯誤');
    }
    return;
  }
  
  const data = await response.json();
  // 處理成功回應
} catch (error) {
  console.error('API Error:', error);
  alert('網路錯誤，請稍後再試');
}
```

## Rate Limiting

API 實施速率限制以防止濫用：

- **認證端點**: 5 次/分鐘
- **一般端點**: 100 次/分鐘
- **批量操作**: 10 次/分鐘

超過限制時會返回 `429 Too Many Requests` 狀態碼。

## CORS 設定

API 支援跨域請求，允許的設定：

```javascript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}
```

## 版本管理

API 版本通過 URL 路徑指定：
- 當前版本: `/api/v1/`
- 未來版本: `/api/v2/`（規劃中）

舊版本會維護至少 6 個月的向後相容性。

## 測試環境

### 測試帳號

| 電話 | 密碼 | 角色 | 說明 |
|------|------|------|------|
| 0900000001 | 001 | admin | 系統管理員 |
| 0987654321 | 321 | owner | 王業主 |
| 0912345678 | 678 | team_leader | 張工班長 |
| 0955555555 | 555 | team_member | 李師傅 |

### Postman Collection

可匯入 [Postman Collection](./postman/construction-api.json) 進行 API 測試。

## SDK 支援

### JavaScript SDK

```javascript
import { ConstructionAPI } from '@construction/sdk';

const api = new ConstructionAPI({
  baseURL: 'https://api.yes-ceramics.com',
  token: 'your-token'
});

// 獲取專案列表
const projects = await api.projects.list();

// 新增工班成員
const member = await api.teams.addMember('team_001', {
  userId: 'user_001',
  role: 'team_member'
});
```

## Webhook 支援

系統支援以下事件的 Webhook 通知：

- `member.added` - 成員新增
- `member.updated` - 成員更新
- `member.removed` - 成員移除
- `site.completed` - 案場完工

### Webhook 設定

```json
{
  "url": "https://your-webhook-endpoint.com",
  "events": ["member.added", "site.completed"],
  "secret": "your-webhook-secret"
}
```

---

最後更新：2025-08-15