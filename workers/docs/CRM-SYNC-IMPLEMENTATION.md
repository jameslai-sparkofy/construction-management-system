# 紛享銷客 CRM 同步實現文檔

## 成功的創建方法

### 1. 認證流程
```javascript
// 獲取 corpAccessToken
const response = await fetch('https://open.fxiaoke.com/cgi/corpAccessToken/get/V2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appId: 'FSAID_1320691',
    appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
    permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
  })
});

// 響應格式
{
  "errorCode": 0,
  "corpAccessToken": "token_string",
  "corpId": "781014"
}
```

### 2. 獲取有效的 currentOpenUserId
```javascript
// 必須通過 getUserByMobile API 獲取
const response = await fetch('https://open.fxiaoke.com/cgi/user/getByMobile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    corpId: corpId,
    corpAccessToken: corpAccessToken,
    mobile: "17675662629"  // 管理員手機號
  })
});

// 響應格式
{
  "errorCode": 0,
  "empList": [{
    "openUserId": "FSUID_6D8AAEFBF14B69998CF7D51D21FD8309",
    "name": "用戶名"
  }]
}
```

### 3. 創建工地師父（自定義對象）

**關鍵點**：必須使用 `/cgi/crm/custom/v2/data/create` 端點

```javascript
const response = await fetch('https://open.fxiaoke.com/cgi/crm/custom/v2/data/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    corpAccessToken: corpAccessToken,
    corpId: corpId,
    currentOpenUserId: openUserId,  // 從 getUserByMobile 獲得
    data: {
      object_data: {
        dataObjectApiName: "object_50HJ8__c",  // 工地師父對象
        owner: [openUserId],
        name: "師父姓名",
        phone_number__c: "0912345678",
        abbreviation__c: "簡稱",
        password__c: "密碼後三碼",
        account__c: "帳號",
        LINE_user_id__c: "LINE_ID",
        field_D1087__c: "團隊ID"
      },
      details: {},
      needConvertLookup: false
    }
  })
});

// 成功響應
{
  "errorCode": 0,
  "dataId": "68a69cc3bb4f5f0001f4b2e4"  // CRM 記錄 ID
}
```

## 欄位對應表

### 工地師父 (object_50HJ8__c)
| D1 欄位 | CRM API 欄位 | 說明 |
|---------|--------------|------|
| name | name | 姓名（必填） |
| phone | phone_number__c | 手機號碼 |
| abbreviation | abbreviation__c | 簡稱 |
| password | password__c | 密碼 |
| account | account__c | 帳號 |
| line_user_id | LINE_user_id__c | LINE ID |
| team_id | field_D1087__c | 團隊 |
| avatar_url | field_Imtt7__c | 頭像 URL |

### 案場 (object_8W9cb__c)
| D1 欄位 | CRM API 欄位 | 說明 |
|---------|--------------|------|
| shift_time | shift_time__c | 工班時間 |
| worker_name | field_u1wpv__c | 工地師父名字 |
| construction_date | field_23pFq__c | 施工日期 |
| completed | construction_completed__c | 施工完成 |
| before_photo_url | field_V3d91__c | 施工前照片 |
| after_photo_url | field_3Fqof__c | 施工後照片 |

## 架構設計

### 本地 UUID + 延遲綁定
1. **創建流程**：
   - 立即在 D1 創建記錄（使用本地 UUID）
   - 異步創建到 CRM
   - 成功後更新 D1 記錄的 crm_id

2. **優點**：
   - 立即可用，不等待 CRM
   - 容錯性高
   - 可重試失敗的同步

### 同步狀態管理
```sql
-- workers 表結構
CREATE TABLE workers (
  id TEXT PRIMARY KEY,           -- 本地 UUID
  crm_id TEXT,                   -- CRM 記錄 ID
  sync_status TEXT DEFAULT 'pending',  -- pending/synced/failed
  sync_error TEXT,
  last_sync_at DATETIME,
  -- 其他欄位...
);
```

## 常見錯誤處理

### 錯誤 10006：無效的 currentOpenUserId
**解決**：使用 getUserByMobile API 獲取有效的 openUserId

### 錯誤 13002：無效的對象 API 名稱
**解決**：確認使用正確的對象名稱（object_50HJ8__c）

### 錯誤 600001：請求參數為空
**解決**：檢查必填欄位（name, owner）

## 部署配置

### Cloudflare Workers 環境變數
```toml
[vars]
FX_CRM_API_URL = "https://open.fxiaoke.com"
FX_APP_ID = "FSAID_1320691"
FX_APP_SECRET = "ec63ff237c5c4a759be36d3a8fb7a3b4"
FX_PERMANENT_CODE = "899433A4A04A3B8CB1CC2183DA4B5B48"
```

### API Token 權限
生產環境 API Token: `2rj0qA0MMuCcH_4kGvS8vXIRsVhI9MDdO3GB7tGs`
- 已確認有完整權限
- 可用於部署和管理

## 測試驗證

### 成功創建的記錄 ID
- `68a69cc3bb4f5f0001f4b2e4`
- `68a69cdbb6bc8800018e5dfe`

這些記錄已成功創建到 CRM，證明方法有效。