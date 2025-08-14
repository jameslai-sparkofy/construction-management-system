# Supabase 認證系統部署指南

## 1. 執行 SQL Schema

請在 Supabase Dashboard 的 SQL Editor 中依序執行以下檔案：

### 步驟 1: 執行最小化認證架構
```sql
-- 執行 minimal-auth-schema.sql
-- 這會建立必要的認證表格和映射表
```

### 步驟 2: 確認表格建立成功
在 Supabase Dashboard 中檢查以下表格是否存在：
- `user_profiles`
- `auth_mapping`
- `auth_sessions`

## 2. 設定 RLS 政策

確保 Row Level Security 已啟用並正確設定：

```sql
-- 檢查 RLS 狀態
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'auth_mapping', 'auth_sessions');
```

## 3. 測試認證映射

### 建立測試用戶
```sql
-- 測試：建立一個業主帳號
-- 電話：0912345678，密碼：678
-- 這應該透過前端介面執行，而非直接 SQL
```

## 4. 前端整合檢查清單

- [ ] project-create.html 已更新
- [ ] owner-management.html 已部署
- [ ] member-management.html 已更新
- [ ] unified-permissions.js 已部署

## 5. D1 資料庫確認

確保 D1 資料庫有以下欄位：

### projects 表
- `opportunity_id` - 關聯到商機

### project_permissions 表
- `user_id` - 用戶 ID
- `project_id` - 專案 ID
- `role` - 角色 (admin/owner/foreman/worker)
- `can_view` - 查看權限
- `can_edit` - 編輯權限
- `can_manage_members` - 管理成員權限
- `can_view_other_teams` - 查看其他工班權限

## 6. 環境變數確認

確保前端有正確的配置：
```javascript
// Supabase 配置
const supabaseUrl = 'https://pbecqosbkuyypsgwxnmq.supabase.co'
const supabaseAnonKey = '...'

// API 配置
const WORKER_API_URL = 'https://construction-management-api-clerk.lai-jameslai.workers.dev'
const API_BASE_URL = 'https://fx-d1-rest-api.lai-jameslai.workers.dev'
```

## 7. 測試流程

### 測試 1: 建立專案並設定業主
1. 登入為 admin
2. 前往 project-create.html
3. 選擇商機
4. 在第四步選擇業主和工班負責人
5. 確認建立成功

### 測試 2: 業主管理
1. 登入為 admin
2. 前往 member-management.html
3. 點擊「業主管理」按鈕
4. 新增業主
5. 確認業主可以登入

### 測試 3: 權限驗證
1. 使用業主帳號登入（電話/密碼末3碼）
2. 確認只能查看，不能編輯
3. 確認可以看到所有工班進度

## 8. 常見問題

### Q: 業主無法登入
A: 檢查：
1. Supabase 用戶是否建立成功
2. auth_mapping 表是否有映射記錄
3. D1 的 project_permissions 是否有權限記錄

### Q: 權限不正確
A: 檢查：
1. unified-permissions.js 是否正確載入
2. D1 的權限資料是否正確
3. 快取是否需要清除

### Q: 資料不同步
A: 這是正常的！我們故意不同步資料，而是：
- Supabase 只管認證
- D1 管所有業務資料
- 透過 auth_mapping 連結兩者

## 9. 回滾方案

如果需要回滾：
```sql
-- 在 Supabase 執行
DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TABLE IF EXISTS auth_mapping CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
```

## 10. 監控建議

定期檢查：
1. auth_mapping 表的映射數量
2. 孤立的 Supabase 用戶（沒有 D1 映射）
3. 過期的 session