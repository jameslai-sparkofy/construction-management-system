# 工程管理系統部署指南

## 系統架構概述

本系統採用以下架構：
- **認證層**: Supabase Auth（處理用戶登入）
- **業務資料**: Cloudflare D1（存儲所有業務資料）
- **映射層**: auth_mapping 表（連接 Supabase 用戶與 D1 資料）
- **前端**: 靜態 HTML + JavaScript
- **API**: Cloudflare Workers

## 部署步驟

### 1. Supabase 設定

#### 1.1 建立 Supabase 專案
1. 前往 [Supabase Dashboard](https://app.supabase.com)
2. 建立新專案或使用現有專案
3. 記錄以下資訊：
   - Project URL: `https://pbecqosbkuyypsgwxnmq.supabase.co`
   - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 1.2 執行資料庫架構
在 Supabase SQL Editor 中執行：

```sql
-- 執行 supabase/minimal-auth-schema.sql
```

這會建立三個表：
- `user_profiles` - 用戶基本資料
- `auth_mapping` - 認證映射
- `auth_sessions` - Session 管理

#### 1.3 建立測試用戶
1. 開啟 `frontend/test-permissions.html`
2. 打開瀏覽器控制台（F12）
3. 複製並執行 `scripts/create-test-users.js` 的內容
4. 執行 `createTestUsers()` 建立測試用戶

### 2. Cloudflare D1 設定

#### 2.1 建立 D1 資料庫
```bash
# 使用 Cloudflare API Token
export CLOUDFLARE_API_TOKEN="your-token-here"

# 建立資料庫（如果尚未建立）
npx wrangler d1 create engineering-management
```

#### 2.2 初始化資料庫結構
```bash
# 執行 D1 schema
npx wrangler d1 execute engineering-management --file=scripts/init-d1-permissions.sql --remote
```

### 3. Cloudflare Workers 部署

#### 3.1 更新配置
編輯 `workers/wrangler.toml`：
- 更新 Supabase 配置
- 確認 D1 database ID
- 設定環境變數

#### 3.2 部署 Worker
```bash
cd workers
npm install

# 開發環境
npx wrangler deploy

# 生產環境
npx wrangler deploy --env production
```

#### 3.3 驗證部署
```bash
# 檢查健康狀態
curl https://construction-management-api.lai-jameslai.workers.dev/health
```

### 4. 前端部署

#### 4.1 更新配置
編輯 `frontend/config.js`：

```javascript
const CONFIG = {
  API: {
    WORKER_API_URL: 'https://construction-management-api.lai-jameslai.workers.dev',
    CRM_API_URL: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
    SUPABASE_URL: 'https://pbecqosbkuyypsgwxnmq.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key'
  }
};
```

#### 4.2 部署到 Cloudflare Pages
```bash
# 部署前端
npx wrangler pages deploy frontend --project-name construction-management-frontend
```

### 5. 測試驗證

#### 5.1 測試認證流程
1. 訪問 `https://your-domain/login-supabase-unified.html`
2. 使用測試帳號登入：
   - 管理員: `0900000001` / `001`
   - 工班長: `0912345678` / `678`
   - 業主: `0987654321` / `321`

#### 5.2 測試權限系統
1. 訪問 `https://your-domain/test-permissions.html`
2. 執行各項測試：
   - 系統狀態檢查
   - 登入/登出測試
   - 權限驗證
   - 完整流程測試

#### 5.3 驗證功能
- ✅ 用戶登入
- ✅ 權限檢查
- ✅ 專案列表
- ✅ 專案詳情
- ✅ 成員管理（管理員）
- ✅ 業主管理（管理員）

## 環境配置

### 開發環境
```bash
# .env.development
ENVIRONMENT=development
WORKER_API_URL=https://construction-api-development.lai-jameslai.workers.dev
ENABLE_DEBUG=true
```

### 生產環境
```bash
# .env.production
ENVIRONMENT=production
WORKER_API_URL=https://construction-management-api.lai-jameslai.workers.dev
ENABLE_DEBUG=false
```

## 常見問題

### Q: 用戶無法登入
**A**: 檢查以下項目：
1. Supabase 用戶是否已建立
2. auth_mapping 表是否有映射記錄
3. D1 的 project_permissions 是否有權限記錄

### Q: API 連接失敗
**A**: 檢查：
1. Worker 是否正確部署
2. CORS 設定是否正確
3. API Token 是否有效

### Q: 權限不正確
**A**: 檢查：
1. unified-permissions.js 是否載入
2. D1 權限資料是否正確
3. 清除瀏覽器快取

## 資料結構

### Supabase (認證層)
```
auth.users          → Supabase 內建用戶表
user_profiles       → 用戶基本資料
auth_mapping        → 映射到 D1 用戶
auth_sessions       → Session 管理
```

### D1 (業務層)
```
projects            → 專案資料
project_permissions → 專案權限
teams              → 工班資料
team_members       → 工班成員
progress_reports   → 進度報告
```

## 權限矩陣

| 角色 | 查看 | 編輯 | 管理成員 | 查看其他工班 |
|------|------|------|----------|--------------|
| admin | ✅ | ✅ | ✅ | ✅ |
| owner | ✅ | ❌ | ❌ | ✅ |
| foreman | ✅ | ✅ | ✅ | ❌ |
| worker | ✅ | ✅ | ❌ | ❌ |

## 監控與維護

### 日誌查看
```bash
# 查看 Worker 日誌
npx wrangler tail construction-management-api

# 查看即時日誌
npx wrangler tail construction-management-api --format pretty
```

### 資料備份
```bash
# 備份 D1 資料庫
npx wrangler d1 backup create engineering-management

# 列出備份
npx wrangler d1 backup list engineering-management
```

### 更新部署
1. 更新程式碼
2. 測試本地環境
3. 部署到開發環境
4. 驗證功能
5. 部署到生產環境

## 安全建議

1. **定期更新密鑰**
   - JWT Secret
   - API Tokens
   - Supabase Keys

2. **啟用 RLS**
   - 確保 Supabase RLS 已啟用
   - 定期檢查政策

3. **監控異常**
   - 設定警報
   - 檢查異常登入
   - 監控 API 使用量

4. **備份策略**
   - 每日自動備份
   - 異地備份
   - 定期測試還原

## 聯絡支援

如有問題，請聯絡：
- 技術支援：[support@example.com]
- 緊急聯絡：[emergency@example.com]

---

最後更新：2025-08-14